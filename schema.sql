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
    email       VARCHAR(255),
    created_at  TIMESTAMP   DEFAULT NOW()
);

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
-- ÍNDICES (melhora performance das queries mais comuns)
-- ==========================================
CREATE INDEX idx_projects_scrum_master     ON projects(scrum_master);
CREATE INDEX idx_test_members_test_id      ON test_members(test_id);
CREATE INDEX idx_test_members_member_id    ON test_members(member_id);
CREATE INDEX idx_extra_activities_status   ON extra_activities(status);
CREATE INDEX idx_project_tests_project_id  ON project_tests(project_id);
CREATE INDEX idx_project_tests_status      ON project_tests(status);

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
