import { NextResponse } from 'next/server';

export function proxy(request) {
  const session = request.cookies.get('horas_extras_session');
  const { pathname } = request.nextUrl;

  // Rotas públicas
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Verificar autenticação
  if (!session || session.value !== 'authenticated_admin_2026') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
