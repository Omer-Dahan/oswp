'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Event } from '~/app/utils/shared-types'
import { useRsvpForm } from '~/components/contexts/rsvp-form-context'
import { stepHeadingFont, stepPrimaryClassName } from '~/components/website/forms/steps/step-ui'
import { hebrewDateFor } from '~/lib/hebrew-date'
import { buildEveningCalendarLinks } from '~/lib/website/calendar'
import { resolveWazeUrl } from '~/lib/website/maps'
import { coupleNamesHe } from '~/lib/wedding/couple-name'
import { resolveRsvpEvents } from '~/lib/wedding/rsvp-events'

type RsvpConfirmationProps = {
  basePath: string
}

const bodyFont = 'font-[family-name:var(--tpl-body-font)]'
const calendarPillPrimary = `${bodyFont} inline-flex h-12 items-center justify-center rounded-full bg-primary px-5 text-base text-primary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
const calendarPillSecondary = `${bodyFont} inline-flex h-12 items-center justify-center rounded-full border border-foreground/30 bg-white/70 px-5 text-base text-foreground/90 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`

const directionsLinkClassName = `${bodyFont} inline-flex min-h-14 w-full items-center justify-center rounded-full border border-foreground/30 bg-white/70 px-6 text-foreground text-lg transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-foreground/50 hover:bg-white active:translate-y-0 active:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`

export default function RsvpConfirmation({ basePath }: RsvpConfirmationProps) {
  const t = useTranslations('rsvp')
  const router = useRouter()
  const rsvpFormData = useRsvpForm()

  const household = rsvpFormData.selectedHousehold
  const guests = household?.guests ?? []
  const primaryGuest = household?.primaryContact ?? guests[0]
  const isFamily = guests.length > 1

  const namedAttendingGuestIds = new Set(
    rsvpFormData.rsvpResponses
      .filter((response) => response.rsvp === 'Attending')
      .map((response) => response.guestId)
  )
  const hasAttending =
    namedAttendingGuestIds.size > 0 ||
    (rsvpFormData.attendingCount ?? 0) > namedAttendingGuestIds.size

  const heading = hasAttending
    ? isFamily && primaryGuest?.lastName
      ? t('confirmationThanksFamily', { lastName: primaryGuest.lastName })
      : primaryGuest?.firstName
        ? t('confirmationThanksName', { firstName: primaryGuest.firstName })
        : t('confirmationThanksFallback')
    : t('confirmationDeclinedThanks')

  const attendingCount = rsvpFormData.attendingCount ?? 0
  const childrenCount = rsvpFormData.childrenCount ?? 0
  const countLine = hasAttending
    ? childrenCount > 0
      ? t('confirmationCountWithChildren', { count: attendingCount, children: childrenCount })
      : t('confirmationCount', { count: attendingCount })
    : null

  const dietaryNotes = rsvpFormData.dietaryNotes?.trim()

  const allEvents = (rsvpFormData.weddingData.events ?? []) as Event[]
  const events = allEvents.filter((event) =>
    rsvpFormData.rsvpResponses.some((response) => event.id === response.eventId)
  )
  const scopedEventIds = new Set(events.map((event) => event.id))
  const { weddingEvent, chuppahEvent } = resolveRsvpEvents(allEvents)
  const reception = weddingEvent ? allEvents.find((event) => event.id === weddingEvent.id) : null
  const chuppah = chuppahEvent ? allEvents.find((event) => event.id === chuppahEvent.id) : null
  const confirmationTimes = [
    reception && scopedEventIds.has(reception.id) && reception.startTime
      ? { event: reception, label: t('confirmationReception') }
      : null,
    chuppah && scopedEventIds.has(chuppah.id) && chuppah.startTime
      ? { event: chuppah, label: t('confirmationChuppah') }
      : null,
  ].filter((item): item is { event: Event; label: string } => item !== null)

  // One calendar entry for the whole evening: the chuppah is part of the same
  // night, not a second appointment, so the guest saves one block that names
  // both times instead of clicking "add to calendar" twice.
  const eveningTitle = coupleNamesHe(rsvpFormData.weddingData as never)
    ? `החתונה של ${coupleNamesHe(rsvpFormData.weddingData as never)}`
    : 'החתונה שלנו'
  const websiteSubUrl = (rsvpFormData.weddingData as { website?: { subUrl?: string } }).website
    ?.subUrl
  const calendarEventQuery = events
    .map((event) => `event=${encodeURIComponent(event.id)}`)
    .join('&')
  const eveningCalendar = hasAttending
    ? buildEveningCalendarLinks({ title: eveningTitle, events })
    : null
  const venueEvent = events[0]
  const wazeHref = venueEvent
    ? resolveWazeUrl({
        venue: venueEvent.venue ?? null,
        venueAddress: venueEvent.venueAddress ?? null,
        venueWazeUrl: venueEvent.venueWazeUrl ?? null,
      })
    : null

  return (
    <div className='fixed inset-0 z-0 overflow-y-auto'>
      <div className='absolute inset-0'>
        <Image
          src='/brand/linen-bg-portrait.png'
          alt=''
          aria-hidden
          fill
          priority
          sizes='100vw'
          className='object-cover object-center md:hidden'
        />
        <Image
          src='/brand/linen-bg.png'
          alt=''
          aria-hidden
          fill
          priority
          sizes='100vw'
          className='hidden object-cover object-center md:block'
        />
        <div className='absolute inset-0 bg-background/35' />
      </div>

      <div className='relative z-10 flex min-h-full items-center justify-center px-4 py-24'>
        <div
          className='w-full rounded-[18px] border border-foreground/10 bg-[#FBF7F1] p-6 sm:max-w-[min(680px,calc(100vw-32px))] sm:p-8'
          style={{ boxShadow: '0 12px 32px rgba(46,38,32,.10)' }}
        >
          <div className='flex flex-col gap-6 whitespace-pre-line'>
            <div className='rsvp-confirmation-block flex flex-col gap-2 text-center'>
              <h2 className={`${stepHeadingFont} text-2xl text-foreground sm:text-3xl`}>
                {heading}
              </h2>
              {countLine && (
                <p className={`${bodyFont} text-base text-foreground/80`}>{countLine}</p>
              )}
            </div>

            {hasAttending && confirmationTimes.length > 0 && (
              <div className='rsvp-confirmation-block flex flex-col gap-2' dir='rtl'>
                {confirmationTimes.map(({ event, label }) => {
                  const hebrewDate = hebrewDateFor({
                    date: event.date,
                    hebrewDateOverride: event.hebrewDateOverride ?? null,
                  })

                  return (
                    <p
                      key={event.id}
                      className={`${bodyFont} text-right text-foreground/85 text-lg tabular-nums`}
                    >
                      {label}
                      {hebrewDate ? ` · ${hebrewDate}` : ''}
                      {' · '}
                      <time dateTime={event.startTime ?? undefined}>{event.startTime}</time>
                    </p>
                  )
                })}
              </div>
            )}

            <div className='rsvp-confirmation-block flex flex-col items-center gap-4'>
              <button
                type='button'
                className={stepPrimaryClassName}
                onClick={() => router.push(basePath)}
              >
                {t('backToHomepage')}
              </button>

              {hasAttending && eveningCalendar && (
                <div className='rsvp-confirmation-block flex w-full flex-col items-center gap-3 rounded-[14px] border border-foreground/10 bg-white/50 p-4'>
                  <div className='flex w-full flex-col gap-2 sm:flex-row'>
                    <a
                      className={`${calendarPillPrimary} sm:flex-1`}
                      href={
                        websiteSubUrl
                          ? `/api/calendar/wedding/${websiteSubUrl}${calendarEventQuery ? `?${calendarEventQuery}` : ''}`
                          : eveningCalendar.googleUrl
                      }
                      // A real .ics URL is what makes iOS offer "Add to Calendar";
                      // a blob download only lands in Files.
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {t('addToAppleCalendar')}
                    </a>
                    <a
                      className={`${calendarPillSecondary} sm:flex-1`}
                      href={eveningCalendar.googleUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {t('addGoogleCalendar')}
                    </a>
                  </div>
                  {wazeHref && (
                    <a
                      className={directionsLinkClassName}
                      href={wazeHref}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-label={t('navigateToVenue')}
                    >
                      {t('navigateToVenue')}
                    </a>
                  )}
                </div>
              )}
            </div>

            {hasAttending && dietaryNotes && (
              <div className='rsvp-confirmation-block rounded-[12px] bg-muted/40 p-4 text-start'>
                <p className={`${bodyFont} mb-1 text-foreground/70 text-sm`}>
                  {t('dietaryNotesTitle')}
                </p>
                <p className={`${bodyFont} whitespace-pre-wrap text-muted-foreground text-sm`}>
                  {dietaryNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
