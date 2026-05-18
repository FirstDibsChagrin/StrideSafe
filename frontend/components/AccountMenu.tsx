'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface AccountMenuProps {
  email: string
}

type Modal = 'password' | 'email' | 'delete' | null

const field: React.CSSProperties = {
  background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#e2e2f0',
  borderRadius: '8px', padding: '10px 14px', width: '100%', fontSize: '14px', outline: 'none',
}

export default function AccountMenu({ email }: AccountMenuProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const openModal = (m: Modal) => { setModal(m); setInputValue(''); setFeedback(null); setOpen(false) }

  const handleUpdate = async () => {
    if (!inputValue.trim()) return
    setSaving(true); setFeedback(null)
    try {
      const payload = modal === 'password' ? { password: inputValue } : { email: inputValue }
      const { error } = await supabase.auth.updateUser(payload)
      if (error) throw error
      setFeedback({ ok: true, msg: modal === 'password' ? 'Password updated.' : 'Confirmation sent to new email.' })
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

  const handleDelete = async () => {
    setSaving(true); setFeedback(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to delete account')
      }
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : 'Something went wrong.' })
      setSaving(false)
    }
  }

  const initial = email.charAt(0).toUpperCase()

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white focus:outline-none"
          style={{ background: '#f97316' }}
          aria-label="Account menu"
        >
          {initial}
        </button>

        {open && (
          <div
            className="absolute right-0 top-11 z-50 w-56 rounded-xl py-1"
            style={{ background: '#13131f', border: '1px solid #2a2a3a', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          >
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #2a2a3a' }}>
              <p className="text-xs" style={{ color: '#6b6b80' }}>Signed in as</p>
              <p className="mt-0.5 truncate text-sm font-medium" style={{ color: '#e2e2f0' }}>{email}</p>
            </div>
            <button
              onClick={() => openModal('password')}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
              style={{ color: '#e2e2f0' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e1e2e')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Change Password
            </button>
            <button
              onClick={() => openModal('email')}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
              style={{ color: '#e2e2f0' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e1e2e')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Change Email
            </button>
            <div style={{ borderTop: '1px solid #2a2a3a', margin: '4px 0' }} />
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
              style={{ color: '#f97316' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(249,115,22,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Sign Out
            </button>
            <button
              onClick={() => openModal('delete')}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Delete Account
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
            {modal === 'delete' ? (
              <>
                <h2 className="text-base font-semibold" style={{ color: '#e2e2f0' }}>Delete Account</h2>
                <p className="mt-2 text-sm" style={{ color: '#9ca3af' }}>
                  This will permanently delete your account and all associated data. This cannot be undone.
                </p>
                {feedback && (
                  <p className="mt-3 text-sm" style={{ color: feedback.ok ? '#4ade80' : '#ef4444' }}>{feedback.msg}</p>
                )}
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="flex-1 rounded-xl py-2 text-sm font-medium"
                    style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: '#ef4444' }}
                  >
                    {saving ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold" style={{ color: '#e2e2f0' }}>
                  {modal === 'password' ? 'Change Password' : 'Change Email'}
                </h2>
                <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
                  {modal === 'password'
                    ? 'Enter a new password for your account.'
                    : 'Enter a new email address. A confirmation will be sent.'}
                </p>
                <input
                  type={modal === 'password' ? 'password' : 'email'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={modal === 'password' ? 'New password' : 'New email address'}
                  style={{ ...field, marginTop: '16px' }}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                  autoFocus
                />
                {feedback && (
                  <p className="mt-2 text-sm" style={{ color: feedback.ok ? '#4ade80' : '#ef4444' }}>{feedback.msg}</p>
                )}
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="flex-1 rounded-xl py-2 text-sm font-medium"
                    style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={saving || !inputValue.trim()}
                    className="flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: '#f97316' }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
