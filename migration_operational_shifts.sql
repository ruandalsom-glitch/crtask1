-- Cria a tabela de escalas operacionais associada a cada quadro e setor
CREATE TABLE IF NOT EXISTS public.operational_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_name TEXT NOT NULL, -- 'Manhã', 'Tarde', 'Noite', 'Turno 1', etc.
  shift_time TEXT, -- '08:00 - 12:00', '12:00 - 18:00', '18:00 - 23:00'
  region_name TEXT NOT NULL, -- 'Sumarezinho', 'Aldeota', 'Recreio', etc.
  operator_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  operator_name TEXT NOT NULL, -- Nome ou identificação da pessoa
  operator_type TEXT DEFAULT 'Dedicado', -- 'Dedicado', 'Apoio', 'Nuvem'
  status TEXT DEFAULT 'Confirmado', -- 'Confirmado', 'Pendente', 'Vaga'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilita RLS (Row Level Security)
ALTER TABLE public.operational_shifts ENABLE ROW LEVEL SECURITY;

-- Politicas de permissao
CREATE POLICY "Permitir leitura para usuarios autenticados" 
  ON public.operational_shifts FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir edicao para usuarios autenticados" 
  ON public.operational_shifts FOR ALL 
  USING (auth.role() = 'authenticated');

