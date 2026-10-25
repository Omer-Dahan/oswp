import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { Button } from '~/components/ui/button'
import { auth } from '~/lib/auth'
import { formatDateStandard } from '~/app/utils/helpers'
import { coupleNamesHe } from '~/lib/wedding/couple-name'
import { db } from '~/server/db'

export const dynamic = 'force-dynamic'

async function loadCoverWedding() {
  const wedding = await db.wedding.findFirst({
    include: {
      website: true,
      events: {
        where: { isPrimary: true },
        take: 1,
      },
    },
  })

  if (!wedding || !wedding.website) {
    return null
  }

  const primaryEvent = wedding.events[0]

  return {
    brideFirstName: wedding.brideFirstName,
    groomFirstName: wedding.groomFirstName,
    subUrl: wedding.website.subUrl,
    date: primaryEvent?.date ?? null,
    venue: primaryEvent?.venue ?? null,
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const cover = await loadCoverWedding()

  if (!cover) {
    return { title: { absolute: 'האתר בהקמה' } }
  }

  return {
    title: { absolute: coupleNamesHe(cover) ?? 'האתר בהקמה' },
  }
}

export default async function Home() {
  noStore()

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    redirect('/dashboard')
  }

  const cover = await loadCoverWedding()

  if (!cover) {
    return (
      <main className='flex min-h-screen items-center justify-center'>
        <p className='font-serif text-lg'>האתר בהקמה</p>
      </main>
    )
  }

  const formattedDate = formatDateStandard(cover.date, 'he')

  return (
    <main className='flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center'>
      <h1 className='font-display font-normal text-[clamp(2.5rem,6vw,4.5rem)] leading-tight tracking-tight'>
        {coupleNamesHe(cover)}
      </h1>

      <div className='flex flex-col gap-1 font-serif text-muted-foreground text-lg'>
        {formattedDate ? <p>{formattedDate}</p> : null}
        {cover.venue ? <p>{cover.venue}</p> : null}
      </div>

      <Button asChild size='lg' className='mt-4'>
        <Link href={`/w/${cover.subUrl}`}>לאתר החתונה</Link>
      </Button>

      <div className='mt-6 flex flex-col items-center gap-2'>
        <div className='flex items-center gap-4 text-sm'>
          <Link href='/auth/sign-in' className='underline-offset-4 hover:underline'>
            כניסה
          </Link>
          <Link href='/auth/sign-up' className='underline-offset-4 hover:underline'>
            הרשמה
          </Link>
        </div>
        <p className='max-w-md text-muted-foreground text-xs'>
          הרשמה באתר מתאפשרת בהזמנה — בלי הזמנה לא ייפתח לכם מרחב עבודה.
        </p>
      </div>
    </main>
  )
}
