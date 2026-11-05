'use client'

import { useEffect, useState } from 'react'

import { SelfInviteLinkManager } from '~/components/guest-list/self-invite-link-manager'
import { Button } from '~/components/ui/button'

type InviteLinkButtonProps = {
  open: boolean
  onToggle: () => void
  className?: string
}

export function InviteLinkButton({ open, onToggle, className }: InviteLinkButtonProps) {
  return (
    <Button
      type='button'
      variant='outline'
      className={className}
      onClick={onToggle}
      aria-expanded={open}
    >
      קישור הזמנה
    </Button>
  )
}

export function InviteLinkContent({ open }: { open: boolean }) {
  if (!open) return null

  return (
    <div className='rounded-lg border border-border bg-muted/20 p-4'>
      <p className='mb-3 font-mono text-[0.58rem] text-foreground/60 uppercase tracking-widest'>
        קישור הזמנה עצמית לאורחים
      </p>
      <p className='mb-3 text-muted-foreground text-sm'>
        שתפו קישור זה כדי שאורחים יוסיפו את פרטי הקשר שלהם לרשימה שלכם.
      </p>
      <SelfInviteLinkManager />
    </div>
  )
}

type InviteLinkPanelProps = {
  className?: string
}

export function InviteLinkPanel({ className }: InviteLinkPanelProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return (
    <>
      <InviteLinkButton open={open} onToggle={() => setOpen((value) => !value)} />
      <div className={className}>
        <InviteLinkContent open={open} />
      </div>
    </>
  )
}
