/**
 * Kitchen Report Page
 *
 * A sheet the venue's kitchen can actually use: who's attending, who needs
 * a kids meal, and who has a dietary restriction - per event, on screen or
 * as an Excel download.
 */

import type { Metadata } from 'next'

import DashboardTopbar from '~/components/dashboard/dashboard-topbar'
import { KitchenReportView } from '~/components/reports/kitchen-report-view'
import { getRequiredWedding } from '~/server/application/authenticated-route/authenticated-route-data'
import { api } from '~/trpc/server'

export const metadata: Metadata = {
  title: 'דף מטבח | אתר החתונה שלכם',
  description: 'רשימת האורחים, מנות הילדים וההגבלות התזונתיות לאירוע',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
}

type KitchenReportPageSearchParams = {
  eventId?: string
}

export default async function KitchenReportPage(
  props: Readonly<{ searchParams?: Promise<KitchenReportPageSearchParams> }>
) {
  const searchParams = (await props.searchParams) ?? {}
  await getRequiredWedding()
  const events = ((await api.event.getAllByUserId()) ?? []).map((event) => ({
    id: event.id,
    name: event.name,
  }))
  const initialEventId = events.find((event) => event.id === searchParams.eventId)?.id ?? null

  return (
    <>
      <DashboardTopbar title='דף מטבח' showManagementActions={false} />
      <main className='flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 lg:px-6 lg:py-6'>
        <KitchenReportView events={events} initialEventId={initialEventId} />
      </main>
    </>
  )
}
