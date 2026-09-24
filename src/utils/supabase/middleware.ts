import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rotas públicas, estatísticas, estáticas e APIs não devem bloquear o Middleware com chamadas remotas de auth
  const isPublicRoute = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/reset-password') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/_next') || 
    pathname === '/favicon.ico';

  if (isPublicRoute && !pathname.startsWith('/login')) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Faz a verificação do usuário logado
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Se o usuário não estiver logado e estiver tentando acessar qualquer tela que NÃO seja o login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se o usuário JÁ estiver logado e tentar acessar a tela de /login
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
