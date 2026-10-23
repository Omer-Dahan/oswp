import type { Metadata } from 'next'

import { ChecklistPageClient } from '~/app/(authenicated)/checklist/_components/checklist-page-client'
import DashboardTopbar from '~/components/dashboard/dashboard-topbar'
import { getRequiredWedding } from '~/server/application/authenticated-route/authenticated-route-data'
import { api } from '~/trpc/server'

export const metadata: Metadata = {
  title: 'רשימת משימות | אתר החתונה שלכם',
  description: 'עקבו אחר משימות ואבני דרך בתכנון החתונה שלכם.',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
}

export default async function ChecklistPage(_props: {
  searchParams?: Promise<Record<string, string>>
}) {
  await getRequiredWedding()

  const [initialTasks, initialMilestones, initialEvents] = await Promise.all([
    api.task.list({}),
    api.milestone.getAll({}),
    api.event.getAllByUserIdWithStats(),
  ])

  return (
    <>
      <DashboardTopbar title='רשימת משימות' showManagementActions={false} />
      <main className='min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6'>
        <ChecklistPageClient
          initialTasks={initialTasks}
          initialMilestones={initialMilestones}
          initialEvents={initialEvents ?? []}
        />
      </main>
    </>
  )
}
