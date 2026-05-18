import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/api/')

  // Redirect unauthenticated users to /login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // On / or /login: redirect to the right place
    if (pathname === '/' || pathname === '/login') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role,team_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.role === 'coach') {
        return NextResponse.redirect(new URL('/coach', request.url))
      } else if (profile?.role === 'runner') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // No role yet — send to onboarding
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    // On any protected page: if no role, send to onboarding
    if (!isPublic) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role,team_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.role) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
      if (!profile?.team_id) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static assets.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
