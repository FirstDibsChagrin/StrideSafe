import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthPage = pathname === '/' || pathname === '/login' || pathname === '/signup'
  const isOnboarding = pathname.startsWith('/onboarding')
  const isApi = pathname.startsWith('/api/')

  // Unauthenticated: only allow public pages
  if (!user) {
    if (!isAuthPage && !isOnboarding && !isApi) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // Authenticated: fetch profile once
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, team_id')
    .eq('id', user.id)
    .maybeSingle()

  const dest = !profile?.role || !profile?.team_id
    ? '/onboarding'
    : profile.role === 'coach' ? '/coach' : '/dashboard'

  // On auth pages: send to correct destination
  if (isAuthPage) {
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Let onboarding and API through
  if (isOnboarding || isApi) return response

  // On protected pages: enforce onboarding and role access
  if (!profile?.role || !profile?.team_id) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }
  if (profile.role === 'coach' && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/coach', request.url))
  }
  if (profile.role === 'runner' && pathname.startsWith('/coach')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
