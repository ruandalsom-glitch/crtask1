-- =========================================================================
-- CR TASK — BLINDAGEM DE SEGURANÇA (RLS & TRIGGERS NO SUPABASE)
-- Execute TODO este script no SQL Editor do Supabase (sem selecionar linhas parciais).
-- =========================================================================

-- 1. Helpers seguros para consultar o cargo do usuário autenticado sem recursão de RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT LOWER(COALESCE(role, 'user'))
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$func$;

CREATE OR REPLACE FUNCTION public.is_leader_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT public.get_my_role() IN ('admin', 'administrador', 'leader', 'lider', 'líder');
$func$;

-- 2. TRIGGER DE PROTEÇÃO CONTRA AUTO-ESCALAÇÃO DE CARGO (profiles.role)
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF public.get_my_role() NOT IN ('admin', 'administrador') THEN
      RAISE EXCEPTION 'Permissão negada: apenas Administradores podem alterar cargos de usuários.';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- 3. MENSAGENS_CHECKLIST: Remove acesso anônimo público e exige autenticação
ALTER TABLE public.mensagens_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso equipe anon" ON public.mensagens_checklist;
DROP POLICY IF EXISTS "Mensagens autenticados" ON public.mensagens_checklist;

CREATE POLICY "Mensagens autenticados" ON public.mensagens_checklist
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. OPERATIONAL_SHIFTS & OPERATIONAL_SHIFT_SETTINGS
ALTER TABLE public.operational_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para usuarios autenticados" ON public.operational_shifts;
DROP POLICY IF EXISTS "Permitir edicao para usuarios autenticados" ON public.operational_shifts;
DROP POLICY IF EXISTS "Shifts leitura autenticados" ON public.operational_shifts;
DROP POLICY IF EXISTS "Shifts escrita lideres e admins" ON public.operational_shifts;
DROP POLICY IF EXISTS "Shifts update lideres e admins" ON public.operational_shifts;
DROP POLICY IF EXISTS "Shifts delete lideres e admins" ON public.operational_shifts;

CREATE POLICY "Shifts leitura autenticados" ON public.operational_shifts
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Shifts escrita lideres e admins" ON public.operational_shifts
  FOR INSERT
  WITH CHECK (public.is_leader_or_admin());

CREATE POLICY "Shifts update lideres e admins" ON public.operational_shifts
  FOR UPDATE
  USING (public.is_leader_or_admin())
  WITH CHECK (public.is_leader_or_admin());

CREATE POLICY "Shifts delete lideres e admins" ON public.operational_shifts
  FOR DELETE
  USING (public.is_leader_or_admin());

ALTER TABLE public.operational_shift_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de settings para autenticados" ON public.operational_shift_settings;
DROP POLICY IF EXISTS "Permitir edicao de settings para autenticados" ON public.operational_shift_settings;
DROP POLICY IF EXISTS "Shift settings leitura autenticados" ON public.operational_shift_settings;
DROP POLICY IF EXISTS "Shift settings escrita lideres e admins" ON public.operational_shift_settings;

CREATE POLICY "Shift settings leitura autenticados" ON public.operational_shift_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Shift settings escrita lideres e admins" ON public.operational_shift_settings
  FOR ALL
  USING (public.is_leader_or_admin())
  WITH CHECK (public.is_leader_or_admin());

-- 5. AI_INSIGHTS: Apenas Líderes e Admins
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_insights') THEN
    ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "AI insights lideres e admins" ON public.ai_insights;
    CREATE POLICY "AI insights lideres e admins" ON public.ai_insights
      FOR ALL
      USING (public.is_leader_or_admin())
      WITH CHECK (public.is_leader_or_admin());
  END IF;
END
$do$;

-- 6. NOTIFICATIONS: Cada usuário lê/atualiza apenas suas próprias notificações (líderes/admins veem tudo)
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Notifications leitura propria" ON public.notifications;
    DROP POLICY IF EXISTS "Notifications insert autenticados" ON public.notifications;
    DROP POLICY IF EXISTS "Notifications update propria" ON public.notifications;

    CREATE POLICY "Notifications leitura propria" ON public.notifications
      FOR SELECT
      USING (
        public.is_leader_or_admin()
        OR LOWER(user_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      );

    CREATE POLICY "Notifications insert autenticados" ON public.notifications
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');

    CREATE POLICY "Notifications update propria" ON public.notifications
      FOR UPDATE
      USING (
        public.is_leader_or_admin()
        OR LOWER(user_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      );
  END IF;
END
$do$;
