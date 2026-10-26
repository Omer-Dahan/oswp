'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { AiOutlineCalendar } from 'react-icons/ai'
import { IoIosCheckmarkCircleOutline } from 'react-icons/io'
import { formatDateStandard } from '~/app/utils/helpers'
import type { Event, Guest, RsvpFormResponse, StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import { upsertRsvpResponses } from '~/components/website/forms/rsvp-state'
import {
  StepActions,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
} from '~/components/website/forms/steps/step-ui'

interface EventRsvpFormProps extends StepFormProps {
  event: Event
  invitedGuests: Guest[]
}

export default function EventRsvpForm({
  goNext,
  goBack,
  event,
  invitedGuests,
}: EventRsvpFormProps) {
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  const existingResponsesForEvent = useMemo(() => {
    return rsvpFormData.rsvpResponses.filter((response) => response.eventId === event.id)
  }, [rsvpFormData.rsvpResponses, event.id])
  const [rsvpResponsesByGuestId, setRsvpResponsesByGuestId] = useState<
    Record<number, RsvpFormResponse>
  >(() => {
    return existingResponsesForEvent.reduce<Record<number, RsvpFormResponse>>((acc, response) => {
      acc[response.guestId] = response
      return acc
    }, {})
  })
  const eventResponses = invitedGuests
    .map((guest) => rsvpResponsesByGuestId[guest.id])
    .filter((response): response is RsvpFormResponse => response !== undefined)
  const hasAnsweredAllGuests = eventResponses.length === invitedGuests.length

  return (
    <StepShell>
      <StepHeading>{event.name}</StepHeading>
      {!!event.date && (
        <div className='flex items-center gap-2 text-base text-muted-foreground'>
          <AiOutlineCalendar size={20} aria-hidden />
          <span>
            {formatDateStandard(event.date, 'he')}
            {event.startTime && ` · ${event.startTime}`}
          </span>
        </div>
      )}
      <ul className='flex flex-col gap-3'>
        {invitedGuests.map((guest) => {
          return (
            <li
              key={guest.id}
              className='flex flex-col gap-3 rounded-[16px] border border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between'
            >
              <span className='text-base text-foreground'>
                {guest.firstName} {guest.lastName}
              </span>
              <RsvpSelection
                eventId={event.id}
                guestId={guest.id}
                guestName={`${guest.firstName} ${guest.lastName}`}
                response={rsvpResponsesByGuestId[guest.id]}
                onSelect={(response) => {
                  setRsvpResponsesByGuestId((prev) => ({
                    ...prev,
                    [response.guestId]: response,
                  }))
                }}
              />
            </li>
          )
        })}
      </ul>
      <StepActions>
        <StepPrimaryButton
          disabled={!hasAnsweredAllGuests}
          onClick={() => {
            updateRsvpForm({
              rsvpResponses: upsertRsvpResponses(rsvpFormData.rsvpResponses, eventResponses),
            })
            goNext?.()
          }}
        >
          {tCommon('continue')}
        </StepPrimaryButton>
        <StepSecondaryButton onClick={() => goBack?.()}>
          {tCommon('back')}
        </StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}

type RsvpSelectionProps = {
  eventId: string
  guestId: number
  guestName: string
  response?: RsvpFormResponse
  onSelect: (response: RsvpFormResponse) => void
}

function RsvpSelection({ eventId, guestId, guestName, response, onSelect }: RsvpSelectionProps) {
  const t = useTranslations('rsvp')
  const selectedRsvp = response?.rsvp

  const handleOnSelect = (selection: 'Attending' | 'Declined') => {
    onSelect({
      eventId,
      guestId,
      guestName,
      rsvp: selection,
    })
  }

  return (
    <div className='flex gap-2'>
      <button
        type='button'
        className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border text-base transition-colors sm:w-28 sm:flex-none ${
          selectedRsvp === 'Attending'
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
        }`}
        onClick={() => handleOnSelect('Attending')}
      >
        {selectedRsvp === 'Attending' && <IoIosCheckmarkCircleOutline size={18} aria-hidden />}
        {selectedRsvp === 'Attending' ? t('accepted') : t('accept')}
      </button>
      <button
        type='button'
        className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border text-base transition-colors sm:w-28 sm:flex-none ${
          selectedRsvp === 'Declined'
            ? 'border-foreground/50 bg-foreground/10 text-foreground'
            : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
        }`}
        onClick={() => handleOnSelect('Declined')}
      >
        {selectedRsvp === 'Declined' && <IoIosCheckmarkCircleOutline size={18} aria-hidden />}
        {selectedRsvp === 'Declined' ? t('declined') : t('decline')}
      </button>
    </div>
  )
}
