# Alinhamento Inteligente de Horários — Especificação Funcional

> Integração com Google Calendar (Google Workspace `@ejectufrn.com.br`) para apoiar a montagem de equipes com horários compatíveis para reuniões recorrentes (daily, planning, review, retro, refinamento).
>
> Este documento já passou por uma revisão crítica (`/grill-me`) e incorpora os ajustes decorrentes dela. A seção 11 registra o que mudou em relação à ideia original e por quê.

---

## 0. Premissas e decisões de arquitetura (fechadas com o time)

| Decisão | Escolha |
|---|---|
| Autenticação Google | **Domain-Wide Delegation** (conta de serviço) sobre o Workspace `@ejectufrn.com.br` — **não** é OAuth 2.0 por usuário |
| Aviso ao membro sobre uso da agenda | Não há aviso explícito (decisão do time, ver §9 LGPD) |
| Backend | Serviço dedicado Node/Express, hospedado no Railway, usando a Supabase service role key |
| Janela de disponibilidade | Segunda a sábado, 07h–22h, horário de Natal/RN (UTC-3, sem horário de verão no Brasil) |
| Granularidade | Slots de 30 min |
| Recorrência | Analisa as **próximas 2–4 semanas** da agenda, cruzando por dia da semana, para sugerir um horário fixo |
| "Tempo real" (RF02) | Sob demanda ao abrir a tela / trocar candidato, servido de um cache recalculado a cada 15–30 min + invalidado nos eventos do RF05 — **não** é push via WebSocket |
| Escala assumida | ~20–60 membros, 5–15 projetos simultâneos → cache simples em Postgres (Supabase), sem Redis/fila |
| Premissa validada com o time | A maioria dos membros mantém aulas/trabalho registrados no Google Calendar — por isso `freebusy` é usado como fonte única, sem camada de disponibilidade declarada manualmente (ver §11 para o risco residual) |
| Outros provedores (Outlook, Apple Calendar) | Fora do escopo desta fase; arquitetura desenhada para permitir adição futura (ver §4) |

---

## 1. História de Usuário

> Como gerente de projetos do Equilibra, quero ver a compatibilidade de horários de um colaborador candidato antes de alocá-lo em um projeto, para montar equipes que consigam de fato se reunir em cerimônias recorrentes, sem descobrir só depois da alocação que os horários não batem.

---

## 2. Fluxo Funcional

1. Gestor abre o modal de alocação de membro em um projeto (fluxo já existente em `projetos.js`).
2. Para cada candidato listado, o sistema exibe um indicador de compatibilidade (🟢🟡🔴⚪), calculado contra os membros já alocados no projeto — servido do cache, sem chamada síncrona ao Google.
3. Gestor clica no indicador → modal de detalhamento com: janelas livres em comum, dias da semana, duração sugerida, quantidade de participantes disponíveis, e o melhor horário recomendado.
4. Gestor confirma a alocação → dispara recálculo do cache de compatibilidade do projeto (RF05).
5. O dashboard (RF06) mostra a visão agregada por projeto/equipe.

A feature **não cria eventos no calendário** — é uma ferramenta de decisão para alocação, não de agendamento. Isso é intencional (ver §11, simplificação aceita).

---

## 3. Fluxo de Autenticação — Domain-Wide Delegation

> **Nota de reconciliação com o RF01 original:** o requisito original pedia OAuth 2.0 por usuário ("cada usuário conecta sua conta"). Isso foi descartado porque o Equilibra não tem sessão de login por membro (só o gestor loga, via Supabase Auth) — não existe "usuário" do lado do membro para disparar um consentimento individual. Como o domínio é Google Workspace administrado, a solução tecnicamente superior é DWD: **um único momento de autorização feito pelo admin do Workspace**, sem fricção por membro, sem tokens por usuário para gerenciar/renovar.

1. Admin do Workspace cria uma conta de serviço no Google Cloud Console, habilita a Calendar API, e concede domain-wide delegation com o escopo de leitura de disponibilidade.
   - **A validar antes da implementação:** confirmar se `https://www.googleapis.com/auth/calendar.freebusy` é aceito como escopo de domain-wide delegation. Se não for, o fallback é `https://www.googleapis.com/auth/calendar.readonly` — o que exige reforçar no backend que **somente** os campos `busy`/`free` são persistidos, nunca título, descrição ou participantes do evento (ver §9).
2. A chave da conta de serviço (JSON) é armazenada como variável de ambiente segura no Railway — nunca no banco, nunca no bundle do frontend.
3. Para consultar a disponibilidade de um membro, o backend gera um JWT assinado impersonando `member.email` (`@ejectufrn.com.br`) e chama `freebusy.query`.
4. Não há tela de "conectar sua conta" nem redirect de consentimento do lado do membro — a falha possível aqui é **técnica** (conta suspensa, licença sem Calendar, erro de impersonação), não uma recusa de conexão. É isso que o indicador ⚪ passa a significar (ver §0 tabela e RF03).

---

## 4. Arquitetura da Solução

```
┌─────────────────────┐        HTTPS + Supabase JWT        ┌──────────────────────────┐
│  Frontend Equilibra   │ ──────────────────────────────────▶ │ equilibra-scheduler-svc   │
│  (Vercel, JS puro)    │ ◀────────────────────────────────── │ (Railway, Node/Express)   │
└─────────────────────┘                                      └───────────┬──────────────┘
                                                                          │
                                    ┌─────────────────────────────────────┼───────────────────────┐
                                    │                                     │                        │
                          Supabase Postgres                    Google Calendar API        Cron interno
                       (service role key, cache)                 (freebusy.query,           (node-cron,
                                                                   conta de serviço DWD)      15-30min)
```

- **Frontend**: novo módulo `js/alinhamento.js` — indicador na lista de candidatos + modal de detalhamento + seção no dashboard. Reaproveita o padrão de módulos já existente (`membros.js`, `projetos.js`).
- **Backend novo** (`equilibra-scheduler-service`, Railway):
  - Único responsável por falar com a Google Calendar API e guardar a chave da conta de serviço.
  - Valida o **JWT de sessão do Supabase** em toda requisição (o gestor já está logado no Supabase Auth no frontend) e restringe CORS ao domínio de produção da Vercel — sem isso a API de disponibilidade fica exposta publicamente.
  - Usa a Supabase service role key só para leitura/escrita das tabelas de cache (não para autenticar o gestor).
- **Supabase Postgres**: tabelas de cache descritas em §5.
- **Extensibilidade multi-provedor**: o backend abstrai a consulta de disponibilidade atrás de uma interface `CalendarProvider.getFreeBusy(email, range)`. Hoje só existe `GoogleWorkspaceProvider`; Outlook/Apple entram como novas implementações da mesma interface, sem tocar no motor de cálculo de compatibilidade.

---

## 5. Modelagem de Dados

```sql
-- Status de sincronização por membro (⚪ quando 'error' ou nunca sincronizado)
CREATE TABLE member_calendar_status (
    member_id       UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    sync_status     VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'ok' | 'error' | 'pending'
    last_synced_at  TIMESTAMP,
    last_error      TEXT
);

-- Janelas livres agregadas por dia da semana (nunca guarda título/descrição de evento)
CREATE TABLE member_free_slots (
    id           SERIAL PRIMARY KEY,
    member_id    UUID REFERENCES members(id) ON DELETE CASCADE,
    weekday      SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=domingo..6=sábado
    slot_start   TIME NOT NULL,
    slot_end     TIME NOT NULL,
    computed_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_free_slots_member_weekday ON member_free_slots(member_id, weekday);

-- Cache de compatibilidade candidato x projeto (o que a UI lê para o indicador)
CREATE TABLE project_compatibility_cache (
    id                    SERIAL PRIMARY KEY,
    project_id            UUID REFERENCES projects(id) ON DELETE CASCADE,
    candidate_member_id   UUID REFERENCES members(id) ON DELETE CASCADE,
    compatibility_level   VARCHAR(10) NOT NULL, -- 'green' | 'yellow' | 'red' | 'gray'
    common_windows        JSONB,      -- [{weekday, start, end, participants_available, participants_total}]
    best_slot             JSONB,      -- {weekday, start, end}
    computed_at           TIMESTAMP DEFAULT NOW(),
    UNIQUE (project_id, candidate_member_id)
);
CREATE INDEX idx_compat_cache_project ON project_compatibility_cache(project_id);
```

Nenhuma tabela armazena `event_id`, título, descrição ou lista de participantes de eventos do Google — só intervalos agregados de livre/ocupado, conforme a regra de negócio de privacidade.

---

## 6. APIs necessárias (equilibra-scheduler-service)

Todas exigem o JWT de sessão do Supabase no header `Authorization`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/availability/status` | Lista membros com `sync_status` (alimenta o ⚪ e o dashboard) |
| GET | `/api/availability/compatibility/:projectId/:candidateId` | Retorna o indicador cacheado |
| GET | `/api/availability/detail/:projectId/:candidateId` | Janelas detalhadas, duração sugerida, melhor horário |
| POST | `/api/availability/refresh` | Dispara recálculo (chamado automaticamente pelo RF05; também exposto para forçar manualmente) |
| GET | `/api/dashboard/availability` | Dados agregados do RF06 |

Internamente, o cron (`node-cron`, 15–30 min) chama a Google Calendar API e repopula `member_free_slots` / `member_calendar_status`; a rota `/refresh` dispara o mesmo caminho sob demanda para os eventos do RF05.

---

## 7. Interface Proposta

- **Lista de candidatos na alocação**: badge de indicador ao lado do nome (🟢🟡🔴⚪), com tooltip curto ("3 janelas em comum esta semana").
- **Modal de detalhamento** (ao clicar no badge): lista de janelas livres por dia, duração sugerida por tipo de cerimônia, contagem "X de Y membros disponíveis" por janela, e um bloco "Horário recomendado" com texto copiável (ex.: "Terças, 14h–15h") — **sem** botão de criar evento (fora de escopo, ver §11).
- **Dashboard — nova seção "Disponibilidade da Equipe"**: por projeto, % de compatibilidade da equipe atual, melhor horário comum, e lista de membros com ⚪ (não sincronizados/com erro).

---

## 8. Critérios de Aceitação (Gherkin)

```gherkin
Funcionalidade: Indicador de compatibilidade de horários

  Cenário: Compatibilidade excelente
    Dado que o candidato tem 3 ou mais janelas recorrentes de 30 min por semana
      em comum com 100% dos membros já alocados no projeto
    Quando o gestor abre a tela de alocação do projeto
    Então o candidato deve exibir o indicador 🟢 "Excelente compatibilidade"

  Cenário: Compatibilidade parcial por poucas janelas
    Dado que o candidato tem apenas 1 ou 2 janelas recorrentes em comum
      com 100% dos membros já alocados
    Quando o gestor abre a tela de alocação do projeto
    Então o candidato deve exibir o indicador 🟡 "Compatibilidade parcial"

  Cenário: Compatibilidade parcial por cobertura incompleta da equipe
    Dado que existem janelas em comum, mas apenas entre 80% e 99% dos membros já alocados
    Quando o gestor abre a tela de alocação do projeto
    Então o candidato deve exibir o indicador 🟡 "Compatibilidade parcial"

  Cenário: Baixa compatibilidade
    Dado que nenhuma janela recorrente reúne pelo menos 80% dos membros já alocados
    Quando o gestor abre a tela de alocação do projeto
    Então o candidato deve exibir o indicador 🔴 "Baixa compatibilidade"

  Cenário: Falha técnica de sincronização
    Dado que a impersonação via conta de serviço falha para o e-mail do candidato
      (conta suspensa, licença sem Calendar, erro de API)
    Quando o gestor abre a tela de alocação do projeto
    Então o candidato deve exibir o indicador ⚪ "Agenda não sincronizada"
    E o motivo da falha deve estar disponível no dashboard (RF06)

  Cenário: Detalhamento ao clicar no indicador
    Dado que um candidato exibe o indicador 🟢 ou 🟡
    Quando o gestor clica no indicador
    Então o sistema deve exibir as janelas livres em comum, os dias da semana,
      a duração sugerida, a contagem de participantes disponíveis por janela
      e o horário recomendado

  Cenário: Recalculo ao alocar um novo membro
    Dado que um projeto já possui um cache de compatibilidade calculado
    Quando um novo membro é alocado ao projeto
    Então o sistema deve recalcular o cache de compatibilidade do projeto
      considerando o novo membro

  Cenário: Recalculo ao remover um membro
    Dado que um projeto já possui um cache de compatibilidade calculado
    Quando um membro é removido do projeto
    Então o sistema deve recalcular o cache de compatibilidade do projeto
      sem considerar o membro removido

  Cenário: Nenhuma janela em comum
    Dado que todos os membros do projeto, incluindo o candidato, não possuem
      nenhum horário livre em comum dentro da janela seg-sáb 07h-22h
    Quando o gestor abre o detalhamento do candidato
    Então o sistema deve informar explicitamente "nenhum horário em comum encontrado"
      em vez de exibir uma lista vazia sem explicação
```

---

## 9. Regras de Negócio, Privacidade e LGPD

- Apenas eventos marcados como "ocupado" bloqueiam horários; eventos "tentative" contam como ocupado (conservador); eventos recusados (`declined`) não contam.
- Eventos de dia inteiro (`all-day`) são ignorados no cálculo, a menos que marcados como "ocupado" explicitamente — do contrário um feriado cadastrado como all-day zeraria a disponibilidade do dia inteiro incorretamente.
- Nunca exibir/persistir título, descrição, local ou lista de participantes de eventos — só os intervalos agregados de livre/ocupado (reforçado na modelagem de dados, §5).
- Fuso horário único assumido (UTC-3, sem horário de verão no Brasil) — não há necessidade de lidar com múltiplos fusos nesta fase, já que a organização opera localmente.
- **Análise LGPD (requisito explícito da revisão crítica):** o uso de Domain-Wide Delegation para consultar a agenda de um membro identificável, sem consentimento individual e sem aviso, é tratamento de dado pessoal (art. 5º, X e art. 6º da LGPD). A decisão do time foi não notificar o membro. Isso é registrado aqui como **risco aceito, com base legal em legítimo interesse / execução de relação organizacional** (art. 7º, IX), dado que: (a) o dado tratado é agregado (livre/ocupado, não o conteúdo do evento), (b) o uso é estritamente para fins de gestão interna da alocação de equipes, (c) o Workspace já é administrado pela organização. Recomenda-se documentar essa base legal formalmente (ex. política interna de uso de dados) mesmo sem notificação individual — isso não está implementado nesta fase, é uma recomendação de governança.
- Priorizar horários recorrentes (mesma janela se repetindo nas semanas analisadas) sobre coincidências pontuais.

---

## 10. Casos de Teste

- 🟢 quando todos os membros do projeto têm 3+ janelas semanais em comum.
- 🟡 quando há 1-2 janelas com 100% de cobertura, e separadamente quando há janelas com 80-99% de cobertura.
- 🔴 quando nenhuma janela atinge 80% de cobertura.
- ⚪ quando a impersonação falha para um membro (simular conta suspensa/sem licença).
- Recalculo automático ao alocar/remover membro (RF05).
- Recalculo automático ao rodar o cron de 15-30 min.
- Evento `tentative` conta como ocupado; evento `declined` não conta.
- Evento all-day não marcado como ocupado não bloqueia o dia.
- Reunião de duração maior que os slots padrão (ex. planning de 2h) — o sistema deve conseguir sugerir um bloco de 2h contíguo, não travar em múltiplos de 30 min isolados.
- Backend rejeita requisição sem JWT de sessão válido do Supabase.
- CORS bloqueia origem diferente do domínio de produção.

---

## 11. Casos Extremos e Riscos (resultado da revisão crítica)

| # | Caso / Risco | Tratamento |
|---|---|---|
| 1 | Membro não mantém a agenda atualizada (calendário vazio ≠ realmente livre) | Premissa validada com o time: a maioria mantém a agenda. **Risco residual aceito**: para a minoria que não mantém, o indicador pode super-representar disponibilidade. Recomendação de acompanhamento: se o time notar isso na prática após o piloto (Fase 5), reavaliar a adição de uma camada de disponibilidade declarada manualmente — não implementada nesta fase. |
| 2 | Membro sem e-mail cadastrado ou fora do domínio `@ejectufrn.com.br` | Exibe ⚪ imediatamente, sem tentar impersonar; mensagem específica no dashboard ("e-mail fora do Workspace") |
| 3 | Quota da Google Calendar API excedida | Backend aplica backoff exponencial no cron; cache antigo continua servindo a UI (nunca bloqueia a tela por erro de API) |
| 4 | Todos os membros do projeto sem nenhuma janela em comum | Ver cenário Gherkin dedicado — mensagem explícita, não lista vazia |
| 5 | Escopo `calendar.freebusy` não suportado para DWD | Fallback documentado para `calendar.readonly` com reforço de que só busy/free é persistido (§3, §5) |
| 6 | Dois gestores alocando no mesmo projeto simultaneamente | Fora de escopo desta fase (decisão explícita, §0: sem push/WebSocket); cache de 15-30 min pode divergir entre telas abertas ao mesmo tempo — aceitável dado o tamanho do time |
| 7 | Feature usada para *criar* reuniões, não só decidir alocação | Fora de escopo intencionalmente (§2) — o objetivo é apoiar decisão de alocação, não virar um agendador. Ver §12 (Roadmap) |

---

## 12. Plano de Implementação

**Fase 1 — Infraestrutura**
Provisionar backend no Railway; criar conta de serviço no Google Cloud + configurar DWD no Admin Console do Workspace; criar as tabelas de cache no Supabase; validar autenticação JWT do Supabase entre frontend e backend.

**Fase 2 — Motor de cálculo**
Implementar `GoogleWorkspaceProvider.getFreeBusy`, agregação em `member_free_slots`, cálculo de `project_compatibility_cache` com os thresholds definidos (§0), cron de 15-30 min.

**Fase 3 — Interface**
Badge de indicador na tela de alocação existente; modal de detalhamento; integração com o fluxo de alocação atual (`projetos.js`).

**Fase 4 — Dashboard**
Seção "Disponibilidade da Equipe" com % de compatibilidade, melhor horário, e membros ⚪.

**Fase 5 — Piloto e validação**
Rodar com 1-2 projetos reais por 2-3 semanas; validar na prática a premissa do risco #1 (§11) antes de considerar a feature "pronta" para todos os projetos.

---

## 13. O que mudou na revisão crítica (`/grill-me`) em relação à ideia inicial

1. **RF01 reinterpretado**: OAuth 2.0 por usuário foi substituído por Domain-Wide Delegation, porque o Equilibra não tem sessão de login por membro. Documentado explicitamente em §3 em vez de deixar o requisito original "pendurado".
2. **Direção da recorrência corrigida**: a análise olha para as **próximas** 2-4 semanas (agenda futura), não para trás — erro do rascunho inicial.
3. **LGPD tratada como risco aceito e documentado**, não omitida (§9), respeitando a decisão do time de não notificar o membro.
4. **Segurança backend↔frontend explicitada**: validação de JWT do Supabase + CORS (§4, §6), ausente no rascunho inicial.
5. **Critérios de aceitação em Gherkin** adicionados como entregável próprio (§8), separado dos casos de teste (§10).
6. **Premissa de qualidade dos dados de calendário** questionada e validada explicitamente com o time antes de aceitar `freebusy` como fonte única (§0, §11 #1) — evita que a feature produza um indicador bonito mas enganoso.
7. **Escopo de criação de eventos removido explicitamente**: a feature apoia decisão de alocação, não agenda reuniões — evitando escopo inflado (ver roadmap futuro abaixo).
8. Regras de `tentative`/`declined`/`all-day` e reuniões mais longas que 60 min adicionadas aos casos extremos e de teste (§9, §10, §11).

### Ideias para o futuro (fora do escopo desta especificação)
- Criar o evento recorrente diretamente no Google Calendar a partir do horário recomendado (com confirmação explícita do gestor).
- Suporte a Outlook/Apple Calendar via a interface `CalendarProvider` já desenhada (§4).
- Camada de disponibilidade declarada manualmente, caso o piloto (Fase 5) mostre que uma parcela relevante de membros não mantém a agenda atualizada.
- Notificação/push em tempo real caso o time cresça a ponto de múltiplos gestores alocarem simultaneamente com frequência.
