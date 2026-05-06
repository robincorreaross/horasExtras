import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {

            // Se o valor não for vazio, transforma num Cookie de Sessão
            // Se for vazio (logout), mantém o maxAge para deletar corretamente
            if (value !== '') {
              delete options.maxAge;
              delete options.expires;
            }

            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/api/auth')

  // Nova linha: Identifica se a requisição está indo para a nossa rota do Cron
  const isCronRoute = request.nextUrl.pathname.startsWith('/api/cron')

  // Define route protection logic here
  // Atualizado: Se não tem usuário, NÃO é rota de auth, e NÃO é rota de cron -> Bloqueia
  if (!user && !isAuthRoute && !isCronRoute) {
    // Check if it's protecting an API route
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For dashboard and other protected pages, redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Lógica de inatividade (60 minutos)
  if (user) {
    const now = Date.now()
    const lastActiveStr = request.cookies.get('app_last_active')?.value
    const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : now
    const MAX_IDLE_TIME = 60 * 60 * 1000 // 60 minutos em milissegundos

    if (now - lastActive > MAX_IDLE_TIME) {
      // Faz logout por inatividade
      await supabase.auth.signOut()
      
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('reason', 'timeout')
      
      const redirectResponse = NextResponse.redirect(url)
      // Limpa o cookie de inatividade na resposta de redirecionamento
      redirectResponse.cookies.set('app_last_active', '', { maxAge: 0, path: '/' })
      return redirectResponse
    }

    // Atualiza o cookie de inatividade para renovar a sessão
    supabaseResponse.cookies.set('app_last_active', now.toString(), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      // Sem maxAge/expires = Session Cookie
    })
  }

  // If user is signed in and trying to access /login, redirect to dashboard
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Allow accessing the proxy if the proxy does its own authorization? Or is proxy.js an API route?
  // Let's assume proxy.js is protected.
  return supabaseResponse
}