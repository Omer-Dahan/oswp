import { getTranslations } from 'next-intl/server'
import type { InvitedHousehold } from '~/app/w/[websiteSubUrl]/_lib/invited-household'

type PersonalizedWelcomeProps = {
  invitedHousehold: InvitedHousehold
}

/**
 * A slim, theme-aware banner shown to guests we recognise from their invite
 * link. It greets the household by name and sits above the template's home
 * surface, inheriting the template's colours and fonts via CSS variables, so it
 * stays visually consistent across every template without per-template code.
 */
export async function PersonalizedWelcome({
  invitedHousehold,
}: Readonly<PersonalizedWelcomeProps>) {
  const t = await getTranslations('invite')
  const labelFont = 'font-[family-name:var(--tpl-label-font,var(--tpl-body-font))]'
  const contact = invitedHousehold.primaryContactGreeting

  if (!contact) return null

  const greeting = t('householdGreetingFirstName', { name: contact.name })

  return (
    <aside
      className='w-full border-border/60 border-b bg-primary/5 px-6 py-3 text-center'
      aria-label={t('personalizedWelcomeAriaLabel')}
    >
      <p className={`text-foreground/80 text-sm tracking-wide ${labelFont}`}>{greeting}</p>
    </aside>
  )
}
