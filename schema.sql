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
-- ROW LEVEL SECURITY (opcional — ative se quiser
-- que cada usuário veja apenas seus próprios dados)
-- ==========================================

-- ALTER TABLE members           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE extra_activities  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_tests     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE test_members      ENABLE ROW LEVEL SECURITY;

-- Exemplo de política (repita para cada tabela e operação):
-- CREATE POLICY "Usuário vê apenas seus membros"
--     ON members FOR SELECT
--     USING (auth.uid() = user_id);
--
-- Obs: para usar RLS com user_id, adicione a coluna:
-- ALTER TABLE members ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
-- E passe auth.uid() nos inserts do supabase.js.
