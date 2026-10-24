import { AuthView } from '@daveyplate/better-auth-ui'

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params
  const isSignInPath = path === 'sign-in'
  const showDemoAccounts = process.env.NODE_ENV !== 'production'

  return (
    <main className='flex min-h-screen items-center justify-center bg-background px-4 py-8'>
      <div className='w-full max-w-md space-y-4'>
        <AuthView path={path} />

        {isSignInPath && showDemoAccounts ? (
          <section className='rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm'>
            <h2 className='font-medium text-sm'>חשבונות הדגמה</h2>
            <p className='mt-1 text-muted-foreground text-xs'>
              התחברו לאחד מהחשבונות הבאים כדי לנסות את נתוני ההדגמה של החתונה.
            </p>
            <ul className='mt-2 list-disc space-y-1 ps-5 text-xs'>
              <li>
                <span className='font-medium'>shrek@swamp.wed</span>
              </li>
              <li>
                <span className='font-medium'>fiona@swamp.wed</span>
              </li>
              <li>
                <span className='font-medium'>queen.lillian@swamp.wed</span>
              </li>
            </ul>
            <p className='mt-2 text-xs'>סיסמה: password123</p>
          </section>
        ) : null}
      </div>
    </main>
  )
}
