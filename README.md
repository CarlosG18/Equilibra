# Equilibra
Sistema para gerenciamento de sobrecarga de membros de projetos usando a metodologia SCRUM.

senha do banco: Equ1l1br4@BD

## 🚀 Funcionalidades

- ✅ **Autenticação de usuários** (login/cadastro)
- ✅ **Gestão de membros** da equipe
- ✅ **Gestão de projetos** com pontos de sobrecarga
- ✅ **Definição de Scrum Masters**
- ✅ **Atividades extras** dos membros
- ✅ **Dashboard** com visão geral
- ✅ **Cálculo automático** de sobrecarga
- ✅ **Persistência em banco de dados** (Supabase)
- ✅ **Acesso de qualquer dispositivo**

## 🛠️ Tecnologias

- HTML5, CSS3, JavaScript
- Supabase (Backend como Serviço)
- GitHub Pages / Vercel (Deploy)

## 📦 Instalação

### 1. Configurar Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute o SQL abaixo:

```sql
-- Tabela de membros
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  overload INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Tabela de projetos
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  overload_points INTEGER NOT NULL,
  allocated_members JSONB DEFAULT '[]',
  scrum_master UUID REFERENCES members(id),
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Tabela de atividades extras
CREATE TABLE extra_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'ativa',
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_activities ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança (cada usuário vê apenas seus dados)
CREATE POLICY "Users can view own members" ON members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own members" ON members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own members" ON members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own members" ON members
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para projetos
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para atividades extras
CREATE POLICY "Users can view own activities" ON extra_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities" ON extra_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities" ON extra_activities
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities" ON extra_activities
  FOR DELETE USING (auth.uid() = user_id);