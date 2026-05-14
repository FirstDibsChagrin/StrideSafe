'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface AccountMenuProps {
  email: string
}

type Modal = 'password' | 'email' | null

export default function AccountMenu({ email }: AccountMenuProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const openModal = (m: Modal) => {
    setModal(m)
    setInputValue('')
    setFeedback(null)
    setOpen(false)
  }

  const handleUpdate = async () => {
    if (!inputValue.trim()) return
    setSaving(true)
    setFeedback(null)
    try {
      const payload =
        modal === 'password'
          ? { password: inputValue }
          : { email: inputValue }
      const { error } = await supabase.auth.updateUser(payload)
      if (error) throw error
      setFeedback({
        ok: true,
        msg: modal === 'password' ? 'Password updated.' : 'Confirmation sent to new email.',
      })
      setInputValue('')
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = email.charAt(0).toUpperCase()

  return (
    <>
      {/* Trigger button */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Account menu"
        >
          {initial}
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <p className="text-xs text-gray-400">Signed in as</p>
              <p className="mt-0.5 truncate text-sm font-medium text-gray-900">{email}</p>
            </div>
            <button
              onClick={() => openModal('password')}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Change Password
            </button>
            <button
              onClick={() => openModal('email')}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Change Email
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">
              {modal === 'password' ? 'Change Password' : 'Change Email'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {modal === 'password'
                ? 'Enter a new password for your account.'
                : 'Enter a new email address. A confirmation will be sent.'}
            </p>
            <input
              type={modal === 'password' ? 'password' : 'email'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={modal === 'password' ? 'New password' : 'New email address'}
              className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              autoFocus
            />
            {feedback && (
              <p className={`mt-2 text-sm ${feedback.ok ? 'text-green-700' : 'text-red-600'}`}>
                {feedback.msg}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving || !inputValue.trim()}
                className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
