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
              // Força o cookie a expirar após 60 minutos (3600 segundos) de inatividade
              options.maxAge = 3600;

              // NOTA: Se você preferir que o sistema deslogue estritamente ao 
              // fechar o navegador, comente a linha acima e use as duas abaixo:
              // delete options.maxAge;
              // delete options.expires;

              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignorado intencionalmente se chamado num Server Component
          }
        },
      },
    }
  )
}