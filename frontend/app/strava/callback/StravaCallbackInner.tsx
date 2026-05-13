'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function StravaCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      router.push('/dashboard')
      return
    }

    const exchange = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/strava/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, user_id: user.id }),
      })

      router.push('/dashboard')
    }

    exchange()
  }, [searchParams, router])

  return <p className="text-gray-500">Connecting Strava…</p>
}
