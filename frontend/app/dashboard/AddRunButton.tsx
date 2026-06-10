'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AddRunModal from './AddRunModal'

export default function AddRunButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#e2e2f0' }}
      >
        + Log Run
      </button>

      {open && (
        <AddRunModal
          onClose={() => setOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  )
}
