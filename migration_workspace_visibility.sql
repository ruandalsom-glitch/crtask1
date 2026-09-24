-- Adiciona a coluna visibility_mode na tabela workspaces para controlar a privacidade dos quadros por setor
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS visibility_mode TEXT DEFAULT 'own_only';
