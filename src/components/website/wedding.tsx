import type { InvitedHousehold } from '~/app/w/[websiteSubUrl]/_lib/invited-household'
import { InvitationHero } from '~/components/website/invitation-hero'
import { PersonalizedWelcome } from '~/components/website/personalized-welcome'
import { coupleNamesHe } from '~/lib/wedding/couple-name'
import type { WeddingPageData } from '~/server/domains/website/website.types'
import { resolveTemplate, TemplateThemeProvider } from '~/templates'

type WeddingWebsiteProps = {
  websiteSubUrl: string
  weddingData: WeddingPageData
  /** Set when the visitor is a guest we recognised from their invite link. */
  invitedHousehold?: InvitedHousehold | null
}

/**
 * The guest site home is the invitation itself: both the website-builder and
 * minimal-fallback states render the same invitation-first hero. Other guest
 * routes (/invitation, /save-the-date, /rsvp, /[page]) keep using the
 * template's own surfaces via WeddingSurface, untouched by this.
 */
export default async function WeddingWebsite({
  websiteSubUrl,
  weddingData,
  invitedHousehold,
}: Readonly<WeddingWebsiteProps>) {
  const path = `/w/${websiteSubUrl}`
  const template = resolveTemplate(weddingData.website.templateId)

  // The banner only runs on mobile: desktop folds the same greeting into the
  // hero's own 100svh stage (below the two cards) so the page never scrolls.
  const welcome = invitedHousehold ? (
    <div className='md:hidden'>
      <PersonalizedWelcome invitedHousehold={invitedHousehold} />
    </div>
  ) : null

  return (
    <TemplateThemeProvider template={template}>
      {welcome}
      <InvitationHero
        rsvpHref={`${path}/rsvp`}
        isRsvpEnabled={weddingData.website.isRsvpEnabled}
        coupleNames={coupleNamesHe(weddingData)}
        invitedHousehold={invitedHousehold ?? null}
      />
    </TemplateThemeProvider>
  )
}
