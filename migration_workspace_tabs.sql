-- Adiciona a coluna visible_tabs na tabela workspaces para controlar quais abas do menu aparecem por setor
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS visible_tabs JSONB DEFAULT '["tabela", "kanban", "calendario", "rotina", "escala", "turnos"]'::jsonb;
