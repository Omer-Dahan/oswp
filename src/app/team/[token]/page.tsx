import Link from 'next/link'

import { api } from '~/trpc/server'

import { TeamSignupForm } from './signup-form'

export const dynamic = 'force-dynamic'

const REASON_TEXT: Record<string, string> = {
  not_found: 'הקישור אינו קיים',
  revoked: 'הקישור בוטל',
  expired: 'תוקף הקישור פג',
  used_up: 'הקישור מוצה',
}

export default async function TeamInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const preview = await api.workspaceInvite.preview({ token })

  if (!preview.valid) {
    return (
      <main className='flex min-h-screen items-center justify-center px-6'>
        <div className='flex flex-col items-center gap-4 text-center'>
          <p className='font-serif text-lg'>{REASON_TEXT[preview.reason] ?? 'הקישור אינו תקין'}</p>
          <Link href='/' className='text-sm underline-offset-4 hover:underline'>
            לאתר החתונה
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className='flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center'>
      <h1 className='font-display font-normal text-[clamp(2rem,5vw,3.25rem)] leading-tight tracking-tight'>
        הצטרפות לסביבת העבודה של {preview.coupleNames}
      </h1>

      <p className='max-w-md font-serif text-muted-foreground text-lg'>
        מלאו את הפרטים, בחרו את הצד שלכם, ותוכלו לנהל את המוזמנים יחד איתנו.
      </p>

      <TeamSignupForm token={token} />
    </main>
  )
}
