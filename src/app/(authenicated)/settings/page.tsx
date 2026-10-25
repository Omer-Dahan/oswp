import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PluginsSettingsCard } from '~/app/_components/settings/plugins-settings-card'
import DashboardTopbar from '~/components/dashboard/dashboard-topbar'
import WeddingSettingsForm from '~/components/forms/wedding-settings-form'
import { OrganizationMembersSettingsCard } from '~/components/settings/organization-members-settings-card'
import { OrganizationOutstandingInvitesCard } from '~/components/settings/organization-outstanding-invites-card'
import { TelegramConnectCard } from '~/components/settings/telegram-connect-card'
import { WhatsappConnectionCard } from '~/components/settings/whatsapp-connection-card'
import { WorkspaceInviteLinksCard } from '~/components/settings/workspace-invite-links-card'
import { auth } from '~/lib/auth'
import { getRequiredWedding } from '~/server/application/authenticated-route/authenticated-route-data'
import { resolveWorkspaceScope } from '~/server/application/workspace/workspace-scope'
import { readWorkspaceCapabilities } from '~/server/authz/workspace-capabilities'
import { api } from '~/trpc/server'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let canManageMembers = false

  if (session?.user?.id) {
    const scope = await resolveWorkspaceScope({
      session,
      userId: session.user.id,
    })
    const capabilities = readWorkspaceCapabilities(scope.activeOrganization?.role)
    if (!capabilities.canAccessSettings) {
      redirect('/dashboard')
    }
    canManageMembers = capabilities.canManageMembers
  }

  const wedding = await getRequiredWedding()

  let details: Awaited<ReturnType<typeof api.wedding.getDetails>> | null = null
  let weddingDetailsLoadFailed = false

  try {
    details = await api.wedding.getDetails()
  } catch {
    weddingDetailsLoadFailed = true
  }

  return (
    <>
      <DashboardTopbar title='הגדרות' showManagementActions={false} />
      <div className='min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6'>
        <div className='mx-auto max-w-2xl'>
          <div className='mb-6'>
            <h2 className='font-serif text-foreground text-xl'>פרטי החתונה</h2>
            <p className='mt-1 font-mono text-[0.62rem] text-foreground/55 tracking-wider'>
              עדכנו את השמות שלכם. תאריך ומיקום הטקס מנוהלים מתוך אירועים.
            </p>
          </div>
          <div className='space-y-6'>
            {details ? (
              <WeddingSettingsForm
                initialData={{
                  groomFirstName: details.groomFirstName,
                  groomLastName: details.groomLastName,
                  brideFirstName: details.brideFirstName,
                  brideLastName: details.brideLastName,
                  weddingDate: details.weddingDate,
                  weddingLocation: details.weddingLocation,
                  primaryEventId: details.primaryEventId,
                }}
              />
            ) : weddingDetailsLoadFailed ? (
              <p className='text-foreground/60'>
                לא ניתן לטעון את פרטי החתונה עבור סביבת העבודה הפעילה.
              </p>
            ) : (
              <p className='text-foreground/60'>
                לא נמצאה חתונה. אנא השלימו את תהליך ההצטרפות תחילה.
              </p>
            )}
            <div className='space-y-3'>
              <div>
                <h3 className='font-serif text-foreground text-xl'>תוספים</h3>
                <p className='mt-1 font-mono text-[0.62rem] text-foreground/55 tracking-wider'>
                  הפעילו וכבו תכונות סביבת עבודה אופציונליות עבור החתונה שלכם.
                </p>
              </div>
              <PluginsSettingsCard enabledAddOns={wedding.enabledAddOns} />
            </div>
            <div className='space-y-3'>
              <div>
                <h3 className='font-serif text-foreground text-xl'>חברי הארגון</h3>
                <p className='mt-1 font-mono text-[0.62rem] text-foreground/55 tracking-wider'>
                  הזמינו משתפי פעולה ונהלו גישה לסביבת עבודה זו.
                </p>
              </div>
              <OrganizationMembersSettingsCard />
              <WorkspaceInviteLinksCard canManageMembers={canManageMembers} />
              <OrganizationOutstandingInvitesCard />
            </div>
            <div className='space-y-3'>
              <div>
                <h3 className='font-serif text-foreground text-xl'>אפליקציות מחוברות</h3>
                <p className='mt-1 font-mono text-[0.62rem] text-foreground/55 tracking-wider'>
                  שוחחו עם Etta מאפליקציות אחרות.
                </p>
              </div>
              <TelegramConnectCard />
              <WhatsappConnectionCard />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
