import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rotas públicas, estatísticas e APIs não devem bloquear o Middleware com chamadas de rede
  const isPublicRoute = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/reset-password') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/_next') || 
    pathname === '/favicon.ico';

  // Verificação síncrona ultra-rápida (0ms) da presença dos cookies de autenticação do Supabase
  const hasAuthCookie = request.cookies.getAll().some(
    c => c.name.startsWith('sb-') || c.name.includes('auth-token') || c.name.includes('supabase')
  );

  // Se o usuário JÁ tem cookie de login e tenta acessar a página /login, redireciona para a home
  if (hasAuthCookie && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Se o usuário NÃO tem cookie de login e tenta acessar uma página protegida, redireciona para /login
  if (!hasAuthCookie && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
