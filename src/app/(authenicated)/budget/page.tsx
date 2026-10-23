import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import BudgetOverview from '~/components/budget'
import DashboardTopbar from '~/components/dashboard/dashboard-topbar'
import { getRequiredWedding } from '~/server/application/authenticated-route/authenticated-route-data'
import { api } from '~/trpc/server'

export const metadata: Metadata = {
  title: 'תקציב | אתר החתונה שלכם',
  description: 'עקבו אחר תקציב החתונה, ההוצאות והפיקדונות הניתנים להחזר',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
}

export default async function BudgetPage() {
  await getRequiredWedding()

  let overview: Awaited<ReturnType<typeof api.budget.getOverview>>

  try {
    overview = await api.budget.getOverview()
  } catch {
    redirect('/')
  }

  if (overview === null) {
    redirect('/')
  }

  return (
    <>
      <DashboardTopbar title='תקציב' showManagementActions={false} />
      <main className='min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6'>
        <BudgetOverview initialOverview={overview} />
      </main>
    </>
  )
}
