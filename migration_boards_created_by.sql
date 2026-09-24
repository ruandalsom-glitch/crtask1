-- Adiciona a coluna created_by na tabela boards para vincular o criador ao quadro
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
