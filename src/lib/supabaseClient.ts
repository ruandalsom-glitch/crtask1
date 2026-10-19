import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let cachedUser: User | null | undefined = undefined;
let cachedAt = 0;
let inFlightUserPromise: Promise<User | null> | null = null;
const USER_CACHE_TTL = 60 * 1000; // 60s em memória

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ?? null;
    cachedAt = Date.now();
  });
}

/**
 * Obtém o usuário autenticado de forma instantânea (0ms via sessão local/cache)
 * e deduplica chamadas concorrentes, evitando filas de LockManager e múltiplos
 * round-trips HTTP para /auth/v1/user no carregamento da página.
 */
export async function getFastUser(): Promise<User | null> {
  const now = Date.now();
  if (cachedUser !== undefined && now - cachedAt < USER_CACHE_TTL) {
    return cachedUser;
  }

  if (inFlightUserPromise) {
    return inFlightUserPromise;
  }

  inFlightUserPromise = (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        cachedUser = sessionData.session.user;
        cachedAt = Date.now();
        return cachedUser;
      }

      const { data: userData } = await supabase.auth.getUser();
      cachedUser = userData?.user ?? null;
      cachedAt = Date.now();
      return cachedUser;
    } catch {
      return cachedUser ?? null;
    } finally {
      inFlightUserPromise = null;
    }
  })();

  return inFlightUserPromise;
}

