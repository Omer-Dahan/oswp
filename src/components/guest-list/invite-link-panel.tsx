'use client'

import { useState } from 'react'

import { SelfInviteLinkManager } from '~/components/guest-list/self-invite-link-manager'
import { Button } from '~/components/ui/button'

export function InviteLinkPanel() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant='outline' onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        קישור הזמנה
      </Button>
      {open && (
        <div className='mb-6 rounded-lg border border-border bg-muted/20 p-4'>
          <p className='mb-3 font-mono text-[0.58rem] text-foreground/60 uppercase tracking-widest'>
            קישור הזמנה עצמית לאורחים
          </p>
          <p className='mb-3 text-muted-foreground text-sm'>
            שתפו קישור זה כדי שאורחים יוסיפו את פרטי הקשר שלהם לרשימה שלכם.
          </p>
          <SelfInviteLinkManager />
        </div>
      )}
    </>
  )
}
