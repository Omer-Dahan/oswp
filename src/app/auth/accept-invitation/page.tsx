import { AcceptInvitationCard } from '@daveyplate/better-auth-ui'
import { headers } from 'next/headers'
import Link from 'next/link'

import { auth } from '~/lib/auth'

type AcceptInvitationPageProps = {
  searchParams?: Promise<{
    invitationId?: string
  }>
}

const getInvitePath = (invitationId: string): string =>
  `/auth/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`

const getAuthRedirectHref = (
  authPath: '/auth/sign-in' | '/auth/sign-up',
  invitationId: string
): string => {
  const invitePath = getInvitePath(invitationId)
  return `${authPath}?redirectTo=${encodeURIComponent(invitePath)}`
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className='relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10'>
    <div className='absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(196,99,58,0.16),_transparent_42%),linear-gradient(180deg,rgba(244,238,227,0.98),rgba(244,238,227,0.88))]' />
    <div className='relative w-full max-w-xl rounded-2xl border border-border/70 bg-card/95 p-6 shadow-[0_24px_80px_rgba(46,38,32,0.12)] backdrop-blur-sm sm:p-8'>
      {children}
    </div>
  </main>
)

const Header = ({ title, description }: { title: string; description: string }) => (
  <div className='mb-6 space-y-2 text-center'>
    <p className='font-mono text-[0.62rem] text-foreground/50 uppercase tracking-[0.3em]'>
      סביבת עבודה לחתונה
    </p>
    <h1 className='font-display text-4xl text-foreground italic'>{title}</h1>
    <p className='mx-auto max-w-md font-sans text-foreground/70 text-sm'>{description}</p>
  </div>
)

export default async function AcceptInvitationPage({ searchParams }: AcceptInvitationPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const invitationId = resolvedSearchParams.invitationId

  if (!invitationId) {
    return (
      <Shell>
        <Header
          title='קישור ההזמנה אינו תקין'
          description='בקישור ההזמנה חסרים פרטים נדרשים. התחברו ובקשו מהמארגן לשלוח מחדש את ההזמנה במידת הצורך.'
        />
        <div className='flex justify-center'>
          <Link
            href='/auth/sign-in'
            className='inline-flex items-center rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90'
          >
            עברו להתחברות
          </Link>
        </div>
      </Shell>
    )
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return (
      <Shell>
        <Header
          title='הוזמנתם להצטרף לסביבת עבודה לחתונה'
          description='התחברו או צרו חשבון כדי להמשיך עם ההזמנה הזו. כתובת הדוא"ל של החשבון שתיצרו צריכה להתאים לכתובת שאליה נשלחה ההזמנה. נחזיר אתכם לכאן כדי לאשר אותה.'
        />

        <div className='space-y-3'>
          <Link
            href={getAuthRedirectHref('/auth/sign-in', invitationId)}
            className='inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-2.5 font-medium text-background text-sm hover:opacity-90'
          >
            התחברות להמשך
          </Link>
          <Link
            href={getAuthRedirectHref('/auth/sign-up', invitationId)}
            className='inline-flex w-full items-center justify-center rounded-md border border-border bg-card px-4 py-2.5 font-medium text-card-foreground text-sm hover:bg-muted/40'
          >
            יצירת חשבון להמשך
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <Header
        title='הצטרפות לסביבת העבודה'
        description='עברו על פרטי ההזמנה למטה, ואז אשרו אותה כדי להתחיל לשתף פעולה ב-OSWP.'
      />

      <AcceptInvitationCard
        className='border-0 bg-transparent shadow-none'
        classNames={{
          base: 'border-0 bg-transparent shadow-none',
          description: 'text-foreground/70',
          header: 'pb-3 text-center',
        }}
      />
    </Shell>
  )
}
