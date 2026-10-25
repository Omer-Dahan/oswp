import type { Metadata } from 'next'

import { SignOutButton } from '~/components/auth-buttons'

export const metadata: Metadata = {
  title: { absolute: 'אין גישה' },
}

export default function NoAccessPage() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center'>
      <h1 className='font-display text-2xl'>אין לך עדיין גישה לחתונה הזו</h1>
      <p className='max-w-md text-muted-foreground text-sm'>
        אם קיבלת קישור הזמנה למרחב העבודה, פתחו אותו מחדש כדי להתחבר למרחב הנכון.
      </p>
      <SignOutButton />
    </main>
  )
}
