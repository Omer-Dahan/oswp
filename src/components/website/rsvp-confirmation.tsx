'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import { FaCircleCheck } from 'react-icons/fa6'
import { RxCrossCircled } from 'react-icons/rx'
import type { Event, RsvpFormResponse } from '~/app/utils/shared-types'
import { useRsvpForm } from '~/components/contexts/rsvp-form-context'
import { buildSingleEventCalendarLinks } from '~/lib/website/calendar'

type RsvpConfirmationProps = {
  basePath: string
  setCurrentStep: Dispatch<SetStateAction<number>>
}

export default function RsvpConfirmation({ basePath, setCurrentStep }: RsvpConfirmationProps) {
  const t = useTranslations('rsvp')
  const rsvpFormData = useRsvpForm()
  return (
    <div className='flex flex-col pt-5 pb-8'>
      <h2 className='text-2xl tracking-widest'>
        {t('confirmationTitle', {
          groomFirstName: rsvpFormData.weddingData.groomFirstName ?? '',
          brideFirstName: rsvpFormData.weddingData.brideFirstName ?? '',
        })}
      </h2>
      <Link
        className={`my-5 bg-gray-700 py-3 text-center text-white text-xl tracking-wide`}
        href={basePath}
      >
        {t('backToHomepage')}
      </Link>
      <div className='flex justify-between border-b-2 py-4'>
        <h2 className='text-xl'>{t('yourRsvpResponse')}</h2>
        <button type='button' className='border-b-2 py-1' onClick={() => setCurrentStep(3)}>
          {t('updateResponse')}
        </button>
      </div>
      <ul>
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
    <li className='flex flex-col gap-3 border-b-2 py-6'>
      <div className='flex items-start justify-between'>
        <h3 className='font-bold text-lg'>{event.name}</h3>
        {calendarLinks && (
          <div className='flex items-center gap-3'>
            <a
              className='border-b-2 py-1'
              href={calendarLinks.googleUrl}
              target='_blank'
              rel='noopener noreferrer'
            >
              {tCommon('addToCalendar')} {event.name}
            </a>
            <button type='button' className='border-b-2 py-1' onClick={downloadIcs}>
              {tCommon('downloadIcs')}
            </button>
          </div>
        )}
      </div>
      {rsvpResponses.map((response) => {
        if (response.eventId === event.id) {
          return (
            <div key={`${event.id}_${response.guestId}`} className='flex items-center gap-3'>
              {response.rsvp === 'Attending' ? (
                <FaCircleCheck size={22} />
              ) : (
                <RxCrossCircled size={22} />
              )}
              {response.guestName}
            </div>
          )
        }
        return null
      })}
    </li>
  )
}
