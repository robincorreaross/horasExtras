import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Removemos qualquer tempo de vida pré-definido pelo Supabase.
              // Sem estas propriedades, o navegador cria um "Cookie de Sessão"
              // que é destruído automaticamente ao fechar o navegador.
              delete options.maxAge;
              delete options.expires;

              cookieStore.set(name, value, options)
            })
          } catch {
            // Ocultado intencionalmente
          }
        },
      },
    }
  )
}