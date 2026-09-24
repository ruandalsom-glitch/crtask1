-- 1. Tabela de escalas operacionais
CREATE TABLE IF NOT EXISTS public.operational_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_name TEXT NOT NULL, -- 'MANHÃ', 'TARDE', 'NOITE', etc.
  shift_time TEXT, -- '08:00 - 12:00', '12:00 - 18:00', '18:00 - 23:00'
  region_name TEXT NOT NULL, -- 'Matriz', 'Aldeota', 'Barra', 'Campo', etc.
  operator_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  operator_name TEXT NOT NULL, -- Nome ou identificação da pessoa
  operator_type TEXT DEFAULT 'Dedicado', -- 'Dedicado', 'Apoio', 'Nuvem'
  status TEXT DEFAULT 'Confirmado', -- 'Confirmado', 'Pendente', 'Vaga'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.operational_shifts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.operational_shifts FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir edicao para usuarios autenticados" ON public.operational_shifts FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela de configurações da escala por quadro (Turnos e Regiões fixos/customizáveis)
CREATE TABLE IF NOT EXISTS public.operational_shift_settings (
  board_id UUID PRIMARY KEY REFERENCES public.boards(id) ON DELETE CASCADE,
  shifts JSONB DEFAULT '[
    {"id": "m", "name": "MANHÃ", "time": "08:00 - 12:00", "color": "sky"},
    {"id": "t", "name": "TARDE", "time": "12:00 - 18:00", "color": "amber"},
    {"id": "n", "name": "NOITE", "time": "18:00 - 23:00", "color": "indigo"}
  ]'::jsonb,
  regions JSONB DEFAULT '["Matriz", "Aldeota", "Barra", "Campo"]'::jsonb,
  operator_types JSONB DEFAULT '["Dedicado", "Apoio", "Nuvem"]'::jsonb,
  statuses JSONB DEFAULT '["Confirmado", "Pendente", "Vaga"]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.operational_shift_settings ADD COLUMN IF NOT EXISTS statuses JSONB DEFAULT '["Confirmado", "Pendente", "Vaga"]'::jsonb;


ALTER TABLE public.operational_shift_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Permitir leitura de settings para autenticados" ON public.operational_shift_settings FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir edicao de settings para autenticados" ON public.operational_shift_settings FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tabela de comentários e detalhamento de tarefas do turno
CREATE TABLE IF NOT EXISTS public.operational_shift_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.operational_shifts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.operational_shift_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Permitir leitura de comentarios para autenticados" ON public.operational_shift_comments FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir edicao de comentarios para autenticados" ON public.operational_shift_comments FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
