-- ==========================================
-- SCHEMA DO EQUILIBRA
-- Execute este arquivo no SQL Editor do Supabase
-- ==========================================

-- ==========================================
-- TABELA: members
-- Usada em: supabase.js (adicionarMembro, atualizarMembro, removerMembro)
--           app.js (members global array)
-- ==========================================
CREATE TABLE members (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    role        VARCHAR(255) NOT NULL,
    subarea     VARCHAR(50),  -- 'ux_ui' | 'frontend' | 'backend' | NULL
    email       VARCHAR(255),
    created_at  TIMESTAMP   DEFAULT NOW()
);

-- Migração (execute se a tabela já existir):
-- ALTER TABLE members ADD COLUMN IF NOT EXISTS subarea VARCHAR(50);

-- ==========================================
-- TABELA: projects
-- Usada em: supabase.js (adicionarProjeto, atualizarProjeto, removerProjeto, definirScrumMaster)
--           projetos.js (renderProjects, editProject, deleteProject)
-- ==========================================
CREATE TABLE projects (
    id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    overload_points   INTEGER     NOT NULL DEFAULT 0,
    allocated_members JSONB       DEFAULT '[]'::jsonb,
    scrum_master      UUID        REFERENCES members(id) ON DELETE SET NULL,
    type              VARCHAR(50) CHECK (type IN ('site', 'lp_simples', 'lp_complexa', 'sistema')),
    created_at        TIMESTAMP   DEFAULT NOW()
);

-- ==========================================
-- TABELA: extra_activities
-- Usada em: supabase.js (adicionarAtividade, atualizarAtividade, atualizarStatusAtividade, removerAtividade)
--           atividades_extras.js (renderActivities)
-- Nota: allocated_members é um array de UUIDs (JSONB), não uma FK direta
-- ==========================================
CREATE TABLE extra_activities (
    id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    allocated_members JSONB       DEFAULT '[]'::jsonb,
    points            INTEGER     NOT NULL DEFAULT 0,
    status            VARCHAR(50) DEFAULT 'ativa',
    created_at        TIMESTAMP   DEFAULT NOW()
);

-- ==========================================
-- TABELA: project_tests
-- Usada em: testes.js (createTest, toggleTestStatus, askDeleteTest, loadTests)
-- Nota: id é SERIAL (INTEGER) pois é usado sem aspas nos onclicks
-- ==========================================
CREATE TABLE project_tests (
    id              SERIAL      PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    project_id      UUID        REFERENCES projects(id) ON DELETE CASCADE,
    overload_points INTEGER     DEFAULT 0,
    status          VARCHAR(50) DEFAULT 'em_andamento',
    test_manager    UUID        REFERENCES members(id) ON DELETE SET NULL,
    created_at      TIMESTAMP   DEFAULT NOW()
);

-- ==========================================
-- TABELA: test_members (relação N:N entre project_tests e members)
-- Usada em: testes.js (createTest → insere, loadTests → select via FK)
-- Query: .select('*, projects(name), test_members(member_id)')
-- ==========================================
CREATE TABLE test_members (
    id          SERIAL  PRIMARY KEY,
    test_id     INTEGER REFERENCES project_tests(id) ON DELETE CASCADE,
    member_id   UUID    REFERENCES members(id) ON DELETE CASCADE
);

-- ==========================================
-- TABELA: project_ux_status_history
-- Histórico do ciclo independente de UX/UI por projeto.
-- Usada em: supabase.js (alterarStatusUxUi, buscarHistoricoUxUi)
--           projetos.js (seção exclusiva de UX/UI no modal do projeto)
-- ==========================================
CREATE TABLE project_ux_status_history (
    id                  SERIAL      PRIMARY KEY,
    project_id          UUID        REFERENCES projects(id) ON DELETE CASCADE,
    previous_status     VARCHAR(50),
    new_status          VARCHAR(50) NOT NULL
        CHECK (new_status IN ('nao_iniciado', 'em_andamento', 'finalizado', 'em_correcao')),
    ux_ui_member_id     UUID        REFERENCES members(id) ON DELETE SET NULL,
    nota                TEXT,
    created_at          TIMESTAMP   DEFAULT NOW()
);

-- ==========================================
-- ÍNDICES (melhora performance das queries mais comuns)
-- ==========================================
CREATE INDEX idx_projects_scrum_master     ON projects(scrum_master);
CREATE INDEX idx_test_members_test_id      ON test_members(test_id);
CREATE INDEX idx_test_members_member_id    ON test_members(member_id);
CREATE INDEX idx_extra_activities_status   ON extra_activities(status);
CREATE INDEX idx_project_tests_project_id  ON project_tests(project_id);
CREATE INDEX idx_project_tests_status      ON project_tests(status);
CREATE INDEX idx_ux_status_history_project ON project_ux_status_history(project_id);

-- ==========================================
-- MIGRAÇÕES: adicionar coluna deadline nas tabelas
-- Execute no SQL Editor do Supabase se as tabelas já existirem
-- ==========================================
ALTER TABLE projects          ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE extra_activities  ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE project_tests     ADD COLUMN IF NOT EXISTS deadline DATE;

-- ==========================================
-- MIGRAÇÕES: carga pessoal dos membros
-- Execute no SQL Editor do Supabase se a tabela members já existir
-- ==========================================
ALTER TABLE members ADD COLUMN IF NOT EXISTS num_materias INTEGER DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS trabalho     BOOLEAN DEFAULT FALSE;

-- ==========================================
-- MIGRAÇÃO: gestor de testes
-- Execute no SQL Editor do Supabase se a tabela project_tests já existir
-- ==========================================
ALTER TABLE project_tests ADD COLUMN IF NOT EXISTS test_manager UUID REFERENCES members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_tests_test_manager ON project_tests(test_manager);

-- ==========================================
-- MIGRAÇÃO: data de início dos testes
-- O par é start_date (início) + deadline (prazo final). Um teste só gera
-- sobrecarga depois de iniciado — ver js/overload.js. Testes já existentes
-- ficam com start_date NULL e continuam pontuando normalmente.
-- ==========================================
ALTER TABLE project_tests ADD COLUMN IF NOT EXISTS start_date DATE;

-- ==========================================
-- MIGRAÇÃO: tipo do projeto (classificação + validação de equipe mínima)
-- Execute no SQL Editor do Supabase se a tabela projects já existir
-- ==========================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS type VARCHAR(50)
    CHECK (type IN ('site', 'lp_simples', 'lp_complexa', 'sistema'));

-- ==========================================
-- MIGRAÇÃO: ciclo independente de status do UX/UI
-- Execute no SQL Editor do Supabase se a tabela projects já existir
-- (a CREATE TABLE project_ux_status_history acima só roda numa base nova;
--  se o schema já existe, crie a tabela manualmente com o mesmo DDL)
-- ==========================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_ui_status VARCHAR(50)
    CHECK (ux_ui_status IN ('nao_iniciado', 'em_andamento', 'finalizado', 'em_correcao'));

-- Qual membro de UX/UI (dentre os alocados no projeto) esse status se refere —
-- um projeto pode ter mais de um UX/UI alocado ao longo do tempo.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_ui_member_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- ==========================================
-- MIGRAÇÃO: sobrecarga temporária do UX/UI (por sprints)
-- Enquanto o UX/UI está "Em andamento"/"Em correção", ele ocupa N sprints;
-- os pontos só contam para o membro até ux_ui_deadline vencer.
-- ==========================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_ui_sprints  INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_ui_points   INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_ui_deadline DATE;

-- ==========================================
-- MIGRAÇÃO: se project_ux_status_history já existia com o nome antigo da
-- coluna (responsavel_id), renomeia para ux_ui_member_id. Se a tabela ainda
-- nem existe, cria com o DDL atual. Seguro rodar mais de uma vez.
-- ==========================================
CREATE TABLE IF NOT EXISTS project_ux_status_history (
    id                  SERIAL      PRIMARY KEY,
    project_id          UUID        REFERENCES projects(id) ON DELETE CASCADE,
    previous_status     VARCHAR(50),
    new_status          VARCHAR(50) NOT NULL
        CHECK (new_status IN ('nao_iniciado', 'em_andamento', 'finalizado', 'em_correcao')),
    ux_ui_member_id     UUID        REFERENCES members(id) ON DELETE SET NULL,
    nota                TEXT,
    created_at          TIMESTAMP   DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project_ux_status_history' AND column_name = 'responsavel_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project_ux_status_history' AND column_name = 'ux_ui_member_id'
    ) THEN
        ALTER TABLE project_ux_status_history RENAME COLUMN responsavel_id TO ux_ui_member_id;
    END IF;
END $$;

-- ==========================================
-- MIGRAÇÃO: gerente responsável pelo projeto
-- Execute no SQL Editor do Supabase se a tabela projects já existir
-- ==========================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);

-- ==========================================
-- TABELA: project_situation_reports
-- Histórico de atualizações de situação de cada projeto (uma entrada por
-- período/sprint), usado para gerar o relatório em PDF do projeto.
-- Usada em: supabase.js (adicionarSituacaoProjeto, atualizarSituacaoProjeto,
--           removerSituacaoProjeto, buscarHistoricoSituacao)
--           js/relatoriosSituacao.js (aba "Relatórios de Projetos")
-- O prazo do relatório NÃO fica aqui — vem de projects.deadline, para não
-- duplicar/divergir do prazo já usado no resto do sistema.
-- ==========================================
CREATE TABLE IF NOT EXISTS project_situation_reports (
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

CREATE INDEX IF NOT EXISTS idx_situation_reports_project_id ON project_situation_reports(project_id);

-- ==========================================
-- MIGRAÇÃO: desativar RLS em project_situation_reports
-- Algumas ferramentas (ex: painel do Supabase) ativam RLS automaticamente ao
-- criar uma tabela pela UI. Sem nenhuma policy, isso bloqueia todo INSERT/
-- UPDATE/DELETE feito pela chave anônima ("new row violates row-level
-- security policy"). O app não tem autenticação por usuário/linha — nenhuma
-- outra tabela do schema usa RLS — então mantemos a mesma consistência aqui.
-- Execute no SQL Editor do Supabase se a tabela já existir com RLS ativo.
-- ==========================================
ALTER TABLE project_situation_reports DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- MIGRAÇÃO: status do membro dentro do projeto
-- ("Em desenvolvimento" / "Em impedimento" + motivo do impedimento).
-- Quando um membro está em impedimento, ele não recebe os pontos de
-- sobrecarga do projeto enquanto durar o bloqueio — ver js/overload.js.
-- Execute no SQL Editor do Supabase se a tabela projects já existir.
--
-- Formato: { "<member_id>": { "status": "em_desenvolvimento" | "em_impedimento",
--                              "impedimento": "texto livre" } }
-- Membro sem entrada aqui é tratado como "em_desenvolvimento" (comportamento
-- anterior à esta migração).
-- ==========================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS member_statuses JSONB DEFAULT '{}'::jsonb;

-- ==========================================
-- MIGRAÇÃO: Product Owner do projeto
-- PO é um vínculo por projeto (igual scrum_master), não um cargo do membro
-- — qualquer membro pode ser PO de um projeto. Gera pontuação de sobrecarga
-- de coordenação (mesma fórmula do Scrum Master) — ver js/overload.js.
-- Execute no SQL Editor do Supabase se a tabela projects já existir.
-- ==========================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_po_id ON projects(po_id);

-- ==========================================================================
-- MIGRAÇÃO: tipos de usuário (permissões por papel)
-- Três papéis: diretor (acesso total), gerente (tudo menos apagar membros/
-- projetos/testes; scrum e planejamento só visualização) e membro (só
-- visualização em quase tudo, sem acesso a planejamento).
--
-- equilibra_user_roles é uma tabela NOVA e própria do Equilibra — prefixada
-- porque este projeto Supabase é compartilhado com outro app (financeiro,
-- tabelas users/categories/etc.) sem relação com o Equilibra; não mexemos
-- em nenhuma tabela do outro app.
--
-- equilibra_get_my_role() devolve o papel de quem está logado (pelo e-mail
-- do JWT); se o e-mail não estiver cadastrado, devolve 'membro' — fail-safe
-- pro menor privilégio, não bloqueia o login. É SECURITY DEFINER pra poder
-- ler equilibra_user_roles mesmo com RLS restrito nela a só-diretor (só
-- devolve o papel do PRÓPRIO chamador, nunca a tabela inteira).
--
-- Usada em: js/permissoes.js (fetch do papel após login, gate de UI)
--           js/usuarios.js (CRUD da tabela, tela "Usuários" — só Diretor)
-- Execute no SQL Editor do Supabase se essas tabelas já existirem.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS equilibra_user_roles (
    email       TEXT PRIMARY KEY,
    role        TEXT NOT NULL CHECK (role IN ('diretor', 'gerente', 'membro')),
    created_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO equilibra_user_roles (email, role) VALUES
    ('carlosgabriel@ejectufrn.com.br', 'diretor'),
    ('diretor@ejectufrn.com.br', 'diretor'),
    ('gerentes@ejectufrn.com.br', 'gerente')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION equilibra_get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM equilibra_user_roles WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))),
    'membro'
  );
$$;

GRANT EXECUTE ON FUNCTION equilibra_get_my_role() TO authenticated;

-- RLS só nas tabelas do Equilibra — não mexe nas tabelas do app financeiro
-- que também vive neste projeto Supabase.
ALTER TABLE equilibra_user_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE members                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_activities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_ux_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_situation_reports ENABLE ROW LEVEL SECURITY;

-- equilibra_user_roles: só diretor mexe (leitura do próprio papel passa
-- pela função equilibra_get_my_role(), não por SELECT direto na tabela).
DROP POLICY IF EXISTS eq_roles_all ON equilibra_user_roles;
CREATE POLICY eq_roles_all ON equilibra_user_roles
    FOR ALL
    USING (equilibra_get_my_role() = 'diretor')
    WITH CHECK (equilibra_get_my_role() = 'diretor');

-- members: todos os logados veem; só diretor cria/edita/apaga.
DROP POLICY IF EXISTS eq_members_select ON members;
CREATE POLICY eq_members_select ON members FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS eq_members_write ON members;
CREATE POLICY eq_members_write ON members FOR INSERT WITH CHECK (equilibra_get_my_role() = 'diretor');
DROP POLICY IF EXISTS eq_members_update ON members;
CREATE POLICY eq_members_update ON members FOR UPDATE USING (equilibra_get_my_role() = 'diretor') WITH CHECK (equilibra_get_my_role() = 'diretor');
DROP POLICY IF EXISTS eq_members_delete ON members;
CREATE POLICY eq_members_delete ON members FOR DELETE USING (equilibra_get_my_role() = 'diretor');

-- projects: todos veem; diretor+gerente criam/editam (inclusive scrum_master
-- — não há trigger de coluna, só a aba de Scrum some da UI pro gerente);
-- só diretor apaga.
DROP POLICY IF EXISTS eq_projects_select ON projects;
CREATE POLICY eq_projects_select ON projects FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS eq_projects_insert ON projects;
CREATE POLICY eq_projects_insert ON projects FOR INSERT WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_projects_update ON projects;
CREATE POLICY eq_projects_update ON projects FOR UPDATE USING (equilibra_get_my_role() IN ('diretor','gerente')) WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_projects_delete ON projects;
CREATE POLICY eq_projects_delete ON projects FOR DELETE USING (equilibra_get_my_role() = 'diretor');

-- extra_activities: todos veem; diretor+gerente fazem tudo, inclusive apagar.
DROP POLICY IF EXISTS eq_activities_select ON extra_activities;
CREATE POLICY eq_activities_select ON extra_activities FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS eq_activities_insert ON extra_activities;
CREATE POLICY eq_activities_insert ON extra_activities FOR INSERT WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_activities_update ON extra_activities;
CREATE POLICY eq_activities_update ON extra_activities FOR UPDATE USING (equilibra_get_my_role() IN ('diretor','gerente')) WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_activities_delete ON extra_activities;
CREATE POLICY eq_activities_delete ON extra_activities FOR DELETE USING (equilibra_get_my_role() IN ('diretor','gerente'));

-- project_tests: todos veem; diretor+gerente criam/editam; só diretor apaga.
DROP POLICY IF EXISTS eq_tests_select ON project_tests;
CREATE POLICY eq_tests_select ON project_tests FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS eq_tests_insert ON project_tests;
CREATE POLICY eq_tests_insert ON project_tests FOR INSERT WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_tests_update ON project_tests;
CREATE POLICY eq_tests_update ON project_tests FOR UPDATE USING (equilibra_get_my_role() IN ('diretor','gerente')) WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_tests_delete ON project_tests;
CREATE POLICY eq_tests_delete ON project_tests FOR DELETE USING (equilibra_get_my_role() = 'diretor');

-- test_members: segue project_tests — precisa criar/apagar vínculo ao editar
-- a equipe do teste, mesmo sem apagar o teste em si.
DROP POLICY IF EXISTS eq_test_members_select ON test_members;
CREATE POLICY eq_test_members_select ON test_members FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS eq_test_members_insert ON test_members;
CREATE POLICY eq_test_members_insert ON test_members FOR INSERT WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_test_members_delete ON test_members;
CREATE POLICY eq_test_members_delete ON test_members FOR DELETE USING (equilibra_get_my_role() IN ('diretor','gerente'));

-- project_ux_status_history: todos veem; diretor+gerente registram (log,
-- sem update/delete no app).
DROP POLICY IF EXISTS eq_ux_history_select ON project_ux_status_history;
CREATE POLICY eq_ux_history_select ON project_ux_status_history FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS eq_ux_history_insert ON project_ux_status_history;
CREATE POLICY eq_ux_history_insert ON project_ux_status_history FOR INSERT WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));

-- project_situation_reports: todos veem; diretor+gerente criam/editam; só
-- diretor apaga (mesma regra de "tudo menos apagar" usada em projects).
DROP POLICY IF EXISTS eq_situation_select ON project_situation_reports;
CREATE POLICY eq_situation_select ON project_situation_reports FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS eq_situation_insert ON project_situation_reports;
CREATE POLICY eq_situation_insert ON project_situation_reports FOR INSERT WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_situation_update ON project_situation_reports;
CREATE POLICY eq_situation_update ON project_situation_reports FOR UPDATE USING (equilibra_get_my_role() IN ('diretor','gerente')) WITH CHECK (equilibra_get_my_role() IN ('diretor','gerente'));
DROP POLICY IF EXISTS eq_situation_delete ON project_situation_reports;
CREATE POLICY eq_situation_delete ON project_situation_reports FOR DELETE USING (equilibra_get_my_role() = 'diretor');
