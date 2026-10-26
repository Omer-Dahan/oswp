import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { formatDateStandard } from '~/app/utils/helpers'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { resolvePrimaryContactGreeting } from '~/app/w/[websiteSubUrl]/_lib/invited-household'
import { AddToCalendarButtons } from '~/components/website/add-to-calendar-buttons'
import { EnvelopeReveal } from '~/components/website/household-invite/envelope-reveal'
import { HouseholdRsvpActions } from '~/components/website/household-invite/household-rsvp-actions'
import { InvalidHouseholdInvite } from '~/components/website/household-invite/invalid-household-invite'
import { buildSaveTheDateCalendarLinks } from '~/lib/website/calendar'
import { householdInviteCookieName } from '~/lib/website/cookies'
import { departByLabel, resolveWazeUrl, venueQuery } from '~/lib/website/maps'
import { coupleNames } from '~/lib/wedding/couple-name'
import { resolveRsvpEvents } from '~/lib/wedding/rsvp-events'
import { householdInviteService } from '~/server/application/household-invite'
import { resolveTemplate, TemplateThemeProvider } from '~/templates'

// Match the template surfaces: headings use the template heading font, labels
// fall back to the body font when a template doesn't define a separate label font.
const headingFont = 'font-[family-name:var(--tpl-heading-font)]'
const labelFont = 'font-[family-name:var(--tpl-label-font,var(--tpl-body-font))]'

type SaveTheDatePageProps = {
  params: Promise<{
    websiteSubUrl: string
  }>
  searchParams?: Promise<{
    invalid?: string
    rsvp?: string
  }>
}

const formatGuestName = (guest: { firstName: string; lastName: string }) =>
  [guest.firstName, guest.lastName].filter(Boolean).join(' ')

/** Display the event span as a single day or an inclusive date range. */
const formatEventDateRange = (first: Date, last: Date, locale: string) => {
  // Event dates come from a `@db.Date` column (midnight UTC), so format in UTC to
  // show the day the couple entered regardless of the viewer's timezone.
  const dateFormatter = new Intl.DateTimeFormat(
    locale === 'he' ? 'he-IL' : locale === 'es' ? 'es' : 'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }
  )

  return first.getTime() === last.getTime()
    ? dateFormatter.format(first)
    : `${dateFormatter.format(first)} – ${dateFormatter.format(last)}`
}

const buildSaveTheDateDescription = (
  coupleNamesText: string,
  dateLabel: string | undefined,
  venue: string | null
) => {
  const when = dateLabel ? ` on ${dateLabel}` : ''
  const where = venue ? ` in ${venue}` : ''
  return `${coupleNamesText} are getting married${when}${where}. Open your household save the date to confirm your details.`
}

export async function generateMetadata({ params }: SaveTheDatePageProps): Promise<Metadata> {
  const { websiteSubUrl } = await params

  // Keep the save-the-date flow out of search indexes regardless of who the couple are.
  const baseMetadata: Metadata = {
    robots: {
      index: false,
      follow: false,
    },
  }

  // Link unfurlers (iMessage, WhatsApp, Slack, etc.) follow the invite code
  // redirect to this page, but they rarely carry the httpOnly invite cookie.
  // The couple names, date, and venue are public wedding details tied to the
  // website slug, so derive the preview from the slug instead of the invite
  // code to give shared links a proper "Save the Date" card.
  const summary = await householdInviteService.getPublicWeddingSummary(websiteSubUrl)
  if (!summary) return baseMetadata

  const coupleNamesText = coupleNames(summary) ?? ''
  const title = `Save the Date — ${coupleNamesText}'s Wedding`
  const description = buildSaveTheDateDescription(
    coupleNamesText,
    formatDateStandard(summary.date),
    summary.venue
  )

  return {
    ...baseMetadata,
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function SaveTheDatePage({ params, searchParams }: SaveTheDatePageProps) {
  const { websiteSubUrl } = await params
  const resolvedSearchParams = await searchParams
  const locale = await getLocale()
  const t = await getTranslations('invite')
  const cookieStore = await cookies()
  const code = cookieStore.get(householdInviteCookieName(websiteSubUrl))?.value
  const inviteData = await householdInviteService.getInviteData(websiteSubUrl, code)

  if (!inviteData) return <InvalidHouseholdInvite websiteSubUrl={websiteSubUrl} />

  // Theme the card with the couple's selected template (colours + fonts cascade
  // via CSS variables) and reuse their editable Save the Date copy.
  const template = resolveTemplate(inviteData.templateId)
  const saveTheDateCopy = inviteData.saveTheDate

  const coupleNamesText = coupleNames(inviteData.wedding) ?? ''

  // Greet the household by its primary contact so the page feels personal
  // before the guest even reads the event details below.
  const primaryContactGreeting = resolvePrimaryContactGreeting(
    inviteData.guests.filter((guest) => guest.isTagAlong !== true)
  )

  const { weddingEvent, chuppahEvent } = resolveRsvpEvents(inviteData.events)
  const rsvpOutcome = resolvedSearchParams?.rsvp

  // Everything below is inherited from the wedding's events — no hardcoded copy.
  const datedEvents = inviteData.events
    .filter((event): event is typeof event & { date: Date } => event.date != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const firstEvent = datedEvents[0]
  const lastEvent = datedEvents[datedEvents.length - 1]
  const formattedDate =
    firstEvent && lastEvent ? formatEventDateRange(firstEvent.date, lastEvent.date, locale) : null
  const ceremonyEvent = datedEvents.find((event) => event.name === 'Ceremony')
  const locationEvent = ceremonyEvent ?? firstEvent ?? null
  const location = locationEvent?.venue ?? null
  const wazeUrl = locationEvent
    ? resolveWazeUrl({
        venue: locationEvent.venue ?? null,
        venueAddress: locationEvent.venueAddress ?? null,
        venueWazeUrl: locationEvent.venueWazeUrl ?? null,
      })
    : null
  const locationQuery = locationEvent
    ? venueQuery({
        venue: locationEvent.venue ?? null,
        venueAddress: locationEvent.venueAddress ?? null,
        venueWazeUrl: locationEvent.venueWazeUrl ?? null,
      })
    : null
  const depart = departByLabel(locationEvent?.startTime)

  const calendarLinks = buildSaveTheDateCalendarLinks({
    title: `${coupleNamesText} Wedding`,
    description: [
      `Save the date for the wedding of ${coupleNamesText}! Formal invitation to follow.`,
      wazeUrl ? `נווט לאולם בוויז: ${wazeUrl}` : null,
      depart,
    ]
      .filter((line): line is string => line != null)
      .join('\n'),
    location: locationQuery ?? location ?? undefined,
    events: inviteData.events,
  })

  return (
    <TemplateThemeProvider template={template}>
      <main className='relative min-h-screen overflow-hidden bg-background px-5 py-12 text-foreground sm:py-16'>
        {/* Soft, warm backdrop so the save the date card reads as a framed keepsake. */}
        <div aria-hidden className='pointer-events-none absolute inset-0 -z-10'>
          <div className='absolute -top-32 start-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl' />
          <div className='absolute end-0 bottom-0 h-72 w-72 translate-x-1/4 rounded-full bg-accent/15 blur-3xl' />
        </div>

        <div className='mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-2xl items-center'>
          <EnvelopeReveal
            coupleNames={coupleNamesText}
            coupleNameClassName={headingFont}
            websiteSubUrl={websiteSubUrl}
          >
            <Card className='w-full overflow-hidden border-border/70 shadow-foreground/5 shadow-xl'>
              {/* Slim accent band at the top of the card. */}
              <div className='h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary' />

              <CardContent className='px-6 py-10 sm:px-12 sm:py-14'>
                <div className='text-center'>
                  <p
                    className={`text-muted-foreground text-xs uppercase tracking-[0.28em] ${labelFont}`}
                  >
                    {saveTheDateCopy?.eyebrow ?? t('saveTheDate')}
                  </p>
                  <h1 className={`mt-4 text-5xl italic leading-none sm:text-7xl ${headingFont}`}>
                    {coupleNamesText}
                  </h1>
                  <span className='mx-auto mt-6 block h-px w-16 bg-border' />
                </div>

                {primaryContactGreeting ? (
                  <div className='mt-8 text-center sm:text-start'>
                    <p className={`text-2xl ${headingFont}`}>
                      {primaryContactGreeting.kind === 'family'
                        ? t('householdGreetingFamily', { name: primaryContactGreeting.name })
                        : t('householdGreetingFirstName', { name: primaryContactGreeting.name })}
                    </p>
                    <p className={`mt-1 text-muted-foreground ${labelFont}`}>{t('rsvpHelper')}</p>
                    {inviteData.isRsvpEnabled ? (
                      <HouseholdRsvpActions
                        websiteSubUrl={websiteSubUrl}
                        weddingEvent={weddingEvent}
                        chuppahEvent={chuppahEvent}
                        rsvpOutcome={rsvpOutcome}
                        labelFontClassName={labelFont}
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className='mt-8 grid gap-6 border-border border-y py-8 text-center sm:grid-cols-2 sm:text-start'>
                  <div>
                    <p
                      className={`text-muted-foreground text-xs uppercase tracking-[0.22em] ${labelFont}`}
                    >
                      {t('date')}
                    </p>
                    <p className='mt-2 text-2xl'>{formattedDate ?? t('toBeAnnounced')}</p>
                  </div>
                  <div>
                    <p
                      className={`text-muted-foreground text-xs uppercase tracking-[0.22em] ${labelFont}`}
                    >
                      {t('location')}
                    </p>
                    <p className='mt-2 text-2xl'>{location ?? t('toBeAnnounced')}</p>
                    {wazeUrl ? (
                      <a
                        href={wazeUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={`mt-2 inline-block text-muted-foreground text-xs underline-offset-4 hover:underline ${labelFont}`}
                      >
                        נווט לאולם
                      </a>
                    ) : null}
                  </div>
                </div>

                {calendarLinks ? (
                  <div className='mt-8 text-center sm:text-start'>
                    <p
                      className={`mb-3 text-muted-foreground text-xs uppercase tracking-[0.22em] ${labelFont}`}
                    >
                      {t('addToCalendar')}
                    </p>
                    <div className='flex justify-center sm:justify-start'>
                      <AddToCalendarButtons {...calendarLinks} />
                    </div>
                  </div>
                ) : null}

                <div className='mt-8 text-center sm:text-start'>
                  <p
                    className={`text-muted-foreground text-xs uppercase tracking-[0.22em] ${labelFont}`}
                  >
                    {t('invitedHousehold')}
                  </p>
                  <ul className='mt-3 space-y-2 text-xl'>
                    {inviteData.guests
                      .filter((guest) => guest.isTagAlong !== true)
                      .map((guest) => (
                        <li key={guest.id}>{formatGuestName(guest)}</li>
                      ))}
                  </ul>
                </div>

                {saveTheDateCopy?.message ? (
                  <p className='mt-8 whitespace-pre-line text-muted-foreground leading-7'>
                    {saveTheDateCopy.message}
                  </p>
                ) : null}

                <div className='mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-start'>
                  <Button asChild size='lg' variant='outline'>
                    <Link href={`/w/${websiteSubUrl}`}>{t('viewWebsite')}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </EnvelopeReveal>
        </div>
      </main>
    </TemplateThemeProvider>
  )
}
