'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import type { StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import { Switch } from '~/components/ui/switch'
import {
  canUseExtraGuests,
  clampCount,
  getMaxAttendingBound,
  isGuestAttendingByDefault,
  upsertRsvpResponses,
} from '~/components/website/forms/rsvp-state'
import {
  StepActions,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
  StepStepperButton,
} from '~/components/website/forms/steps/step-ui'

export default function WhoIsComingForm({ goNext, goBack }: StepFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  const household = rsvpFormData.selectedHousehold
  const namedGuests = useMemo(() => household?.guests ?? [], [household])

  const [attendingGuestIds, setAttendingGuestIds] = useState<Set<number>>(
    () =>
      new Set(
        namedGuests
          .filter((guest) =>
            isGuestAttendingByDefault(guest.id, guest.invitations, rsvpFormData.rsvpResponses)
          )
          .map((guest) => guest.id)
      )
  )

  const maxTotal = getMaxAttendingBound(household?.invitedCount, namedGuests.length)
  const extrasAllowed = canUseExtraGuests(household?.invitedCount, namedGuests.length)
  const namedAttendingCount = attendingGuestIds.size
  const maxExtras = clampCount(maxTotal - namedAttendingCount, 0, maxTotal)

  const [extraGuests, setExtraGuests] = useState<number>(() => {
    const previousTotal = rsvpFormData.attendingCount ?? household?.attendingCount ?? 0
    return clampCount(previousTotal - namedAttendingCount, 0, maxExtras)
  })

  const clampedExtraGuests = clampCount(extraGuests, 0, maxExtras)
  const total = namedAttendingCount + clampedExtraGuests

  const toggleGuest = (guestId: number) => {
    setAttendingGuestIds((prev) => {
      const next = new Set(prev)
      if (next.has(guestId)) {
        next.delete(guestId)
      } else {
        next.add(guestId)
      }
      return next
    })
  }

  const onContinue = () => {
    if (household) {
      const responses = namedGuests.flatMap((guest) =>
        guest.invitations.map((invite) => ({
          eventId: invite.eventId,
          guestId: guest.id,
          guestName: `${guest.firstName} ${guest.lastName}`,
          rsvp: attendingGuestIds.has(guest.id) ? 'Attending' : 'Declined',
        }))
      )

      updateRsvpForm({
        rsvpResponses: upsertRsvpResponses(rsvpFormData.rsvpResponses, responses),
        attendingCount: total,
      })
    }
    goNext?.()
  }

  return (
    <StepShell>
      <StepHeading>{t('whoIsComingTitle')}</StepHeading>
      <ul className='flex flex-col gap-3'>
        {namedGuests.map((guest) => (
          <li
            key={guest.id}
            className='flex items-center justify-between gap-3 rounded-[16px] border border-border px-5 py-4'
          >
            <span className='text-base text-foreground'>
              {guest.firstName} {guest.lastName}
            </span>
            <Switch
              checked={attendingGuestIds.has(guest.id)}
              onCheckedChange={() => toggleGuest(guest.id)}
              aria-label={`${guest.firstName} ${guest.lastName}`}
            />
          </li>
        ))}
      </ul>

      <div className='flex flex-col gap-2 rounded-[16px] border border-border px-5 py-4'>
        <div className='flex items-center justify-between'>
          <span className='text-base text-foreground'>{t('totalAttendingLabel')}</span>
          <span className='text-foreground text-lg tabular-nums'>{total}</span>
        </div>

        <div className='flex items-center justify-between pt-2'>
          <span className='text-muted-foreground text-sm'>{t('extraGuestsLabel')}</span>
          <div className='flex items-center gap-4'>
            <StepStepperButton
              disabled={!extrasAllowed || clampedExtraGuests <= 0}
              onClick={() => setExtraGuests((value) => clampCount(value - 1, 0, maxExtras))}
            >
              −
            </StepStepperButton>
            <span className='w-6 text-center text-base text-foreground tabular-nums'>
              {clampedExtraGuests}
            </span>
            <StepStepperButton
              disabled={!extrasAllowed || clampedExtraGuests >= maxExtras}
              onClick={() => setExtraGuests((value) => clampCount(value + 1, 0, maxExtras))}
            >
              +
            </StepStepperButton>
          </div>
        </div>
        <p className='text-muted-foreground text-xs'>{t('maxGuestsHint', { max: maxTotal })}</p>
      </div>

      <StepActions>
        <StepPrimaryButton onClick={onContinue}>{tCommon('continue')}</StepPrimaryButton>
        <StepSecondaryButton onClick={() => goBack?.()}>{tCommon('back')}</StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}
