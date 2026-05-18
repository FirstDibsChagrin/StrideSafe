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
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/api/')

  // Redirect unauthenticated users to /login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from / and /login to the right dashboard
  if (user && (pathname === '/' || pathname === '/login')) {
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
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // For authenticated users on protected pages, ensure onboarding is complete
  if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/coach'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role,team_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !profile.role || !profile.team_id) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
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
