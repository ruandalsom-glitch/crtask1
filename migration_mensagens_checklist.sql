-- =========================================================================
-- TABELA DO RELATÓRIO DE MENSAGENS (SUPABASE)
-- Execute este script no SQL Editor do Supabase (wpuyanodymsjzsqzbmfy)
-- para habilitar a sincronização em tempo real entre Manhã, Tarde e Noite.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.mensagens_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    base TEXT NOT NULL,
    msg_id TEXT NOT NULL,
    checked BOOLEAN DEFAULT FALSE,
    horario_envio TEXT,
    enviado_por TEXT,
    supervisor TEXT,
    analista TEXT,
    assistente TEXT,
    resp_manha TEXT,
    resp_inter TEXT,
    resp_tarde TEXT,
    apoio_manha TEXT,
    apoio_inter TEXT,
    apoio_tarde TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_base_data_msg UNIQUE (data, base, msg_id)
);

-- Habilitar Row Level Security e liberar para o aplicativo da equipe
ALTER TABLE public.mensagens_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso equipe anon" ON public.mensagens_checklist;
CREATE POLICY "Acesso equipe anon" ON public.mensagens_checklist
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Índices para buscas ultrarrápidas
CREATE INDEX IF NOT EXISTS idx_mensagens_checklist_data_base 
    ON public.mensagens_checklist (data, base);
