import type { Metadata } from 'next'

import DashboardTopbar from '~/components/dashboard/dashboard-topbar'
import { WhatsappMessagingScreen } from '~/components/messaging/whatsapp-messaging-screen'
import { getRequiredWedding } from '~/server/application/authenticated-route/authenticated-route-data'

export const metadata: Metadata = {
  title: 'וואטסאפ | אתר החתונה שלכם',
  description: 'שליחת הזמנות ותזכורות לאורחים בוואטסאפ',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
}

export default async function MessagingPage() {
  await getRequiredWedding()

  return (
    <>
      <DashboardTopbar title='וואטסאפ' showManagementActions={false} />
      <main className='min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6'>
        <WhatsappMessagingScreen />
      </main>
    </>
  )
}
