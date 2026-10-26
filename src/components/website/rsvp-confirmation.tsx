'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FaCircleCheck } from 'react-icons/fa6'
import { RxCrossCircled } from 'react-icons/rx'
import { formatDateStandard } from '~/app/utils/helpers'
import type { Event, RsvpFormResponse } from '~/app/utils/shared-types'
import { useRsvpForm } from '~/components/contexts/rsvp-form-context'
import { stepHeadingFont, stepPrimaryClassName } from '~/components/website/forms/steps/step-ui'
import { buildSingleEventCalendarLinks } from '~/lib/website/calendar'

type RsvpConfirmationProps = {
  basePath: string
}

const bodyFont = 'font-[family-name:var(--tpl-body-font)]'
const quietLinkClassName =
  `${bodyFont} text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline`

function downloadIcs(ics: string, fileName: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function RsvpConfirmation({ basePath }: RsvpConfirmationProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
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

  const events = (rsvpFormData.weddingData.events ?? []).filter((event: Event) =>
    rsvpFormData.rsvpResponses.some((response) => event.id === response.eventId)
  )

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
          <div className='flex flex-col gap-6'>
            <div className='rsvp-confirmation-block flex flex-col gap-2 text-center'>
              <h2 className={`${stepHeadingFont} text-2xl text-foreground sm:text-3xl`}>
                {heading}
              </h2>
              {countLine && <p className={`${bodyFont} text-base text-foreground/80`}>{countLine}</p>}
            </div>

            <div className='rsvp-confirmation-block flex flex-col divide-y divide-border'>
              {events.map((event: Event) => (
                <EventRow key={event.id} event={event} rsvpResponses={rsvpFormData.rsvpResponses} />
              ))}
            </div>

            <div className='rsvp-confirmation-block flex flex-col items-center gap-4'>
              <Link className={stepPrimaryClassName} href={basePath}>
                {t('backToHomepage')}
              </Link>

              <div className='flex flex-col items-center gap-2'>
                {hasAttending && events.map((event: Event) => {
                  const calendarLinks = buildSingleEventCalendarLinks(event)
                  if (!calendarLinks) return null
                  return (
                    <div key={event.id} className='flex flex-wrap items-center justify-center gap-4'>
                      <a
                        className={quietLinkClassName}
                        href={calendarLinks.googleUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {tCommon('addToCalendar')} · {event.name}
                      </a>
                      <button
                        type='button'
                        className={quietLinkClassName}
                        onClick={() => downloadIcs(calendarLinks.ics, calendarLinks.fileName)}
                      >
                        {tCommon('downloadIcs')}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {dietaryNotes && (
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

const EventRow = ({
  event,
  rsvpResponses,
}: {
  event: Event
  rsvpResponses: RsvpFormResponse[]
}) => {
  const t = useTranslations('rsvp')

  return (
    <div className='flex flex-col gap-3 py-4 first:pt-0 last:pb-0'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h3 className={`${stepHeadingFont} text-foreground text-lg`}>{event.name}</h3>
        {!!event.date && (
          <span className={`${bodyFont} text-muted-foreground text-sm`}>
            {formatDateStandard(event.date, 'he')}
            {event.startTime && ` · ${event.startTime}`}
          </span>
        )}
      </div>
      <div className='flex flex-col gap-1.5'>
        {rsvpResponses.map((response) => {
          if (response.eventId !== event.id) return null
          const isAttending = response.rsvp === 'Attending'
          return (
            <div
              key={`${event.id}_${response.guestId}`}
              className={`${bodyFont} flex items-center gap-2 text-foreground text-sm`}
            >
              {isAttending ? (
                <FaCircleCheck
                  size={16}
                  className='shrink-0 text-primary'
                  aria-label={t('accepted')}
                />
              ) : (
                <RxCrossCircled
                  size={16}
                  className='shrink-0 text-muted-foreground'
                  aria-label={t('declined')}
                />
              )}
              {response.guestName}
            </div>
          )
        })}
      </div>
    </div>
  )
}
