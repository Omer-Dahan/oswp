'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import { FaCircleCheck } from 'react-icons/fa6'
import { RxCrossCircled } from 'react-icons/rx'
import type { Event, RsvpFormResponse } from '~/app/utils/shared-types'
import { useRsvpForm } from '~/components/contexts/rsvp-form-context'
import { stepHeadingFont, stepPrimaryClassName } from '~/components/website/forms/steps/step-ui'
import { buildSingleEventCalendarLinks } from '~/lib/website/calendar'

type RsvpConfirmationProps = {
  basePath: string
  setCurrentStep: Dispatch<SetStateAction<number>>
}

export default function RsvpConfirmation({ basePath, setCurrentStep }: RsvpConfirmationProps) {
  const t = useTranslations('rsvp')
  const rsvpFormData = useRsvpForm()

  return (
    <div className='flex flex-col gap-8 pt-4 pb-8'>
      <h2 className={`${stepHeadingFont} text-center text-2xl text-foreground sm:text-3xl`}>
        {t('confirmationTitle', {
          groomFirstName: rsvpFormData.weddingData.groomFirstName ?? '',
          brideFirstName: rsvpFormData.weddingData.brideFirstName ?? '',
        })}
      </h2>

      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-base text-foreground/80'>{t('yourRsvpResponse')}</h3>
        <button
          type='button'
          className='text-primary text-sm underline-offset-4 hover:underline'
          onClick={() => setCurrentStep(3)}
        >
          {t('updateResponse')}
        </button>
      </div>

      <ul className='flex flex-col gap-4'>
        {rsvpFormData.weddingData.events?.map((event: Event) => {
          const eventHasInvitedGuests = !!rsvpFormData.rsvpResponses.find(
            (response) => event.id === response.eventId
          )
          if (!eventHasInvitedGuests) return null
          return (
            <ConfirmationListItem
              key={event.id}
              event={event}
              rsvpResponses={rsvpFormData.rsvpResponses}
            />
          )
        })}
      </ul>

      <Link className={stepPrimaryClassName} href={basePath}>
        {t('backToHomepage')}
      </Link>
    </div>
  )
}

const ConfirmationListItem = ({
  event,
  rsvpResponses,
}: {
  event: Event
  rsvpResponses: RsvpFormResponse[]
}) => {
  const tCommon = useTranslations('common')
  const calendarLinks = buildSingleEventCalendarLinks(event)

  const downloadIcs = () => {
    if (!calendarLinks) return
    const blob = new Blob([calendarLinks.ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = calendarLinks.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <li className='flex flex-col gap-4 rounded-[20px] border border-border bg-card p-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <h3 className={`${stepHeadingFont} text-foreground text-xl`}>{event.name}</h3>
        {calendarLinks && (
          <div className='flex flex-wrap items-center gap-2'>
            <a
              className='inline-flex items-center rounded-full border border-border px-4 py-2 text-foreground/80 text-sm transition-colors hover:border-primary hover:text-primary'
              href={calendarLinks.googleUrl}
              target='_blank'
              rel='noopener noreferrer'
            >
              {tCommon('addToCalendar')} {event.name}
            </a>
            <button
              type='button'
              className='inline-flex items-center rounded-full border border-border px-4 py-2 text-foreground/80 text-sm transition-colors hover:border-primary hover:text-primary'
              onClick={downloadIcs}
            >
              {tCommon('downloadIcs')}
            </button>
          </div>
        )}
      </div>
      <div className='flex flex-col gap-2'>
        {rsvpResponses.map((response) => {
          if (response.eventId !== event.id) return null
          const isAttending = response.rsvp === 'Attending'
          return (
            <div
              key={`${event.id}_${response.guestId}`}
              className='flex items-center gap-3 rounded-[12px] bg-muted/40 px-4 py-3 text-base text-foreground'
            >
              {isAttending ? (
                <FaCircleCheck size={20} className='shrink-0 text-primary' aria-hidden />
              ) : (
                <RxCrossCircled size={20} className='shrink-0 text-muted-foreground' aria-hidden />
              )}
              {response.guestName}
            </div>
          )
        })}
      </div>
    </li>
  )
}
