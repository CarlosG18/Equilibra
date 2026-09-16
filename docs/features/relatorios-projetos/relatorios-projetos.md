# Relatórios de Projetos — Especificação Funcional

> Nova subseção do Equilibra para registrar a situação de cada projeto ao longo do tempo e gerar um PDF com os dados mais importantes para quem não acompanha o dia a dia (prazo, resumo do andamento, principal problema enfrentado).
>
> Inspirada na planilha `Controle - Scrum_Projetos.xlsx` (uma aba por projeto, uma linha por sprint), mas simplificada: o foco aqui não é reproduzir a planilha inteira — as colunas de "Testes de Entrega" ficam de fora, já que são um controle à parte.
>
> Este documento passou por uma sessão `/grill-with-docs` e registra as decisões fechadas nela.

---

## 0. Premissas e decisões (fechadas na sessão de grilling)

| Decisão | Escolha |
|---|---|
| Modelo de dados | **Histórico** de atualizações (uma entrada nova por período), não um snapshot único — mais fiel ao espírito da planilha (uma linha por sprint) e não perde informação passada |
| Origem do prazo | Reaproveita `projects.deadline` (já existente no sistema). Não é duplicado na nova tabela, para não divergir do prazo usado no resto do app |
| Localização na UI | Aba dedicada "Relatórios de Projetos" na navegação principal (não dentro do modal de edição do projeto) |
| Campos de cada entrada | Data, resumo do andamento, principal problema enfrentado — os 3 dados pedidos para o PDF — **mais** um checklist de processo (Pipefy atualizado / ATA preenchida / Status report enviado), espelhando a planilha |
| Conteúdo do PDF | Apenas a atualização **mais recente** (snapshot atual), não o histórico completo |
| Checklist no PDF | Aparece também no PDF, numa seção própria abaixo do resumo/problema |
| Biblioteca de PDF | **jsPDF** via CDN, gerado inteiramente no navegador (o app é estático, sem backend próprio) |
| Template `assets/template.docx` | É o template institucional de **Manual do Usuário** da EJECT — conteúdo de manual, não de relatório de projeto. Usado aqui só como referência de **identidade visual**: fonte Exo, cor `#0A374E`, rodapé institucional "Empresa Júnior da ECT/UFRN" — não como arquivo mesclado |
| Permissão de edição | Qualquer usuário logado (sistema ainda não tem papéis/permissões diferenciadas) |
| Editar/excluir entradas | Permitido, seguindo o padrão do resto do sistema (membros, projetos, atividades) |
| Navegação da aba | Lista de projetos → clique abre modal com histórico completo do projeto + formulário de nova entrada + botão "Gerar PDF" |

---

## 1. Modelo de dados

Nova tabela `project_situation_reports` (ver `schema.sql`):

```sql
CREATE TABLE project_situation_reports (
    id                  SERIAL      PRIMARY KEY,
    project_id          UUID        REFERENCES projects(id) ON DELETE CASCADE,
    report_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
    progress_summary    TEXT        NOT NULL,
    main_issue          TEXT,
    pipefy_updated      BOOLEAN     NOT NULL DEFAULT FALSE,
    ata_filled          BOOLEAN     NOT NULL DEFAULT FALSE,
    status_report_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP   DEFAULT NOW()
);
```

O prazo **não** é um campo desta tabela — o PDF e a tela sempre leem `projects.deadline`.

---

## 2. Fluxo funcional

1. Gestor abre a aba "Relatórios de Projetos".
2. A lista mostra todos os projetos com: nome, gerente responsável, prazo (com contagem regressiva, mesmo componente usado na aba Projetos) e um resumo da última atualização (se houver).
3. Ao clicar em "Ver relatório" de um projeto, abre um modal com:
   - Dados de cabeçalho do projeto (gerente, SM, prazo);
   - Histórico completo de atualizações, mais recente primeiro, cada uma com o checklist de processo e ações de editar/excluir;
   - Formulário para registrar uma nova atualização (data, resumo, problema, checklist);
   - Botão "Gerar PDF".
4. "Gerar PDF" usa a atualização mais recente cadastrada para montar um documento de uma página com a identidade visual EJECT (cor `#0A374E`, fonte Exo, rodapé institucional) e baixa o arquivo no navegador.

---

## 3. Fora de escopo (por decisão explícita)

- Colunas de "Testes de Entrega" da planilha (testador interno/externo, status de teste) — já existe uma feature própria de testes (`js/testes.js` / tabela `project_tests`), sem relação direta com este histórico de situação.
- PDF com o histórico completo (fica só a atualização mais recente).
- Geração a partir do arquivo `.docx` literal (mail-merge) — o `.docx` é referência visual, não template de dados.
- Controle de permissões por papel (gerente/SM) — todo usuário logado pode cadastrar/editar/excluir.
