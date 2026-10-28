import type { Metadata } from 'next'

import DashboardTopbar from '~/components/dashboard/dashboard-topbar'
import { MessagingScreen } from '~/components/messaging/messaging-screen'
import { getRequiredWedding } from '~/server/application/authenticated-route/authenticated-route-data'

export const metadata: Metadata = {
  title: 'הודעות | אתר החתונה שלכם',
  description: 'שליחת הזמנות ותזכורות לאורחים',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
}

export default async function MessagingPage() {
  await getRequiredWedding()

  return (
    <>
      <DashboardTopbar title='הודעות' showManagementActions={false} />
      <main className='min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6'>
        <MessagingScreen />
      </main>
    </>
  )
}
