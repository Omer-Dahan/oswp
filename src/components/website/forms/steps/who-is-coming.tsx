'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { IoMdClose } from 'react-icons/io'
import type { StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import { Switch } from '~/components/ui/switch'
import {
  canAddExtraGuestRow,
  canUseExtraGuests,
  clampCount,
  type ExtraGuestRow,
  getFilledExtraGuestNames,
  getInitialAttendingGuestIds,
  getInitialExtraGuests,
  getMaxAttendingBound,
  upsertRsvpResponses,
} from '~/components/website/forms/rsvp-state'
import {
  StepActions,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
  StepStepperButton,
  StepTextInput,
} from '~/components/website/forms/steps/step-ui'

export default function WhoIsComingForm({ goNext, goBack }: StepFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  const household = rsvpFormData.selectedHousehold
  const namedGuests = useMemo(
    () => household?.guests.filter((guest) => !guest.isTagAlong) ?? [],
    [household]
  )
  const existingTagAlongGuests = useMemo(
    () => household?.guests.filter((guest) => guest.isTagAlong) ?? [],
    [household]
  )

  const savedTotal = rsvpFormData.attendingCount ?? household?.attendingCount
  // A saved 0 means "not answered" (defaults are never 0), not "zero attendees".
  const hasAnsweredBefore = savedTotal != null && savedTotal > 0

  const [attendingGuestIds, setAttendingGuestIds] = useState<Set<number>>(() =>
    getInitialAttendingGuestIds(namedGuests, rsvpFormData.rsvpResponses, hasAnsweredBefore)
  )

  const maxTotal = getMaxAttendingBound(household?.invitedCount, namedGuests.length)
  const extrasAllowed = canUseExtraGuests(household?.invitedCount, namedGuests.length)
  const namedAttendingCount = attendingGuestIds.size
  const maxExtras = clampCount(maxTotal - namedAttendingCount, 0, maxTotal)

  const [extraGuestRows, setExtraGuestRows] = useState<ExtraGuestRow[]>(() => {
    const names =
      rsvpFormData.extraGuestNames ??
      existingTagAlongGuests.map((guest) => `${guest.firstName} ${guest.lastName}`.trim())
    return names.map((name) => ({
      id: crypto.randomUUID(),
      name,
    }))
  })

  const [extraGuests, setExtraGuests] = useState<number>(() =>
    getInitialExtraGuests(
      hasAnsweredBefore,
      savedTotal,
      namedAttendingCount,
      extraGuestRows.length,
      maxExtras
    )
  )

  const stepperMax = clampCount(maxTotal - namedAttendingCount - extraGuestRows.length, 0, maxTotal)
  const clampedExtraGuests = clampCount(extraGuests, 0, stepperMax)
  const filledExtraGuestNames = getFilledExtraGuestNames(extraGuestRows)
  const total = namedAttendingCount + filledExtraGuestNames.length + clampedExtraGuests
  const canAddRow = canAddExtraGuestRow(
    namedAttendingCount,
    extraGuestRows.length,
    clampedExtraGuests,
    maxTotal
  )

  const addExtraGuestRow = () => {
    if (!canAddRow) return
    setExtraGuestRows((prev) => [...prev, { id: crypto.randomUUID(), name: '' }])
  }

  const updateExtraGuestRowName = (id: string, name: string) => {
    setExtraGuestRows((prev) => prev.map((row) => (row.id === id ? { ...row, name } : row)))
  }

  const removeExtraGuestRow = (id: string) => {
    setExtraGuestRows((prev) => prev.filter((row) => row.id !== id))
  }

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
        guest.invitations
          .filter(
            (invite) =>
              !rsvpFormData.preselectedEventId || invite.eventId === rsvpFormData.preselectedEventId
          )
          .map((invite) => ({
            eventId: invite.eventId,
            guestId: guest.id,
            guestName: `${guest.firstName} ${guest.lastName}`,
            rsvp: attendingGuestIds.has(guest.id) ? 'Attending' : 'Declined',
          }))
      )

      updateRsvpForm({
        rsvpResponses: upsertRsvpResponses(rsvpFormData.rsvpResponses, responses),
        attendingCount: total,
        extraGuestNames: filledExtraGuestNames,
      })
    }
    goNext?.()
  }

  return (
    <StepShell>
      <StepHeading>{t('whoIsComingTitle')}</StepHeading>
      <ul className='flex flex-col gap-3'>
        {namedGuests.map((guest) => (
          <li key={guest.id}>
            <label
              htmlFor={`attending-guest-${guest.id}`}
              className='flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-border px-5 py-4'
            >
              <span className='text-base text-foreground'>
                {guest.firstName} {guest.lastName}
              </span>
              <Switch
                id={`attending-guest-${guest.id}`}
                checked={attendingGuestIds.has(guest.id)}
                onCheckedChange={() => toggleGuest(guest.id)}
              />
            </label>
          </li>
        ))}
      </ul>

      {extrasAllowed && (
        <ul className='flex flex-col gap-3'>
          {extraGuestRows.map((row, index) => (
            <li key={row.id} className='flex items-end gap-2'>
              <div className='flex-1'>
                <label htmlFor={`extra-guest-${row.id}`} className='sr-only'>
                  {t('extraGuestNameLabel')}
                </label>
                <StepTextInput
                  id={`extra-guest-${row.id}`}
                  value={row.name}
                  placeholder={t('extraGuestNamePlaceholder')}
                  onChange={(event) => updateExtraGuestRowName(row.id, event.target.value)}
                />
              </div>
              <button
                type='button'
                onClick={() => removeExtraGuestRow(row.id)}
                aria-label={`${t('removeExtraGuestLabel')} ${index + 1}`}
                className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              >
                <IoMdClose className='h-5 w-5' />
              </button>
            </li>
          ))}
          <li>
            <StepSecondaryButton
              onClick={addExtraGuestRow}
              disabled={!canAddRow}
              className='w-auto justify-start ps-0'
            >
              {t('addExtraGuestButton')}
            </StepSecondaryButton>
          </li>
        </ul>
      )}

      <div className='flex flex-col gap-2 rounded-[16px] border border-border px-5 py-4'>
        <div className='flex items-center justify-between'>
          <span className='text-base text-foreground'>{t('totalAttendingLabel')}</span>
          <span className='text-foreground text-lg tabular-nums'>{total}</span>
        </div>

        <div className='flex items-center justify-between pt-2'>
          <span className='text-muted-foreground text-sm'>{t('extraGuestsLabel')}</span>
          <div className='flex items-center gap-4'>
            <StepStepperButton
              aria-label={t('removeExtraGuestLabel')}
              disabled={!extrasAllowed || clampedExtraGuests <= 0}
              onClick={() => setExtraGuests((value) => clampCount(value - 1, 0, stepperMax))}
            >
              −
            </StepStepperButton>
            <span className='w-6 text-center text-base text-foreground tabular-nums'>
              {clampedExtraGuests}
            </span>
            <StepStepperButton
              aria-label={t('addExtraGuestButton')}
              disabled={!extrasAllowed || clampedExtraGuests >= stepperMax}
              onClick={() => setExtraGuests((value) => clampCount(value + 1, 0, stepperMax))}
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
