/**
 * Seating Chart Page
 *
 * Drag and drop seating chart builder for the wedding event. Seating never
 * applies to the chuppah, so the page resolves the wedding event itself
 * instead of offering a picker.
 */

import type { Metadata } from 'next'

import DashboardTopbar from '~/components/dashboard/dashboard-topbar'
import { SeatingChartBuilder } from '~/components/seating-chart/seating-chart-builder'
import { resolveRsvpEvents } from '~/lib/wedding/rsvp-events'
import { getRequiredWedding } from '~/server/application/authenticated-route/authenticated-route-data'
import { api } from '~/trpc/server'
import { AsyncState } from '~/components/ui/async-state'

export const metadata: Metadata = {
  title: 'תרשים הושבה | אתר החתונה שלכם',
  description: 'סדרו שולחנות והושיבו את האורחים שלכם',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
}

export default async function SeatingPage() {
  await getRequiredWedding()
  const events = (await api.event.getAllByUserId()) ?? []
  const { weddingEvent } = resolveRsvpEvents(events)

  return (
    <>
      <DashboardTopbar title='תרשים הושבה' showManagementActions={false} />
      <main className='flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 lg:px-6 lg:py-6'>
        {weddingEvent ? (
          <SeatingChartBuilder weddingEventId={weddingEvent.id} />
        ) : (
          <AsyncState isEmpty emptyText='צרו קודם אירוע, ואז חזרו לכאן כדי להושיב אורחים.' />
        )}
      </main>
    </>
  )
}
