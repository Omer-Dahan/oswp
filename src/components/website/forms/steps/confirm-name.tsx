'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { HouseholdSearch, StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import {
  StepActions,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
} from '~/components/website/forms/steps/step-ui'

type HouseholdSearchItem = HouseholdSearch[number]
type GuestWithInvitations = HouseholdSearchItem['guests'][number]

export default function ConfirmNameForm({ goNext, goBack }: StepFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const {
    matchedHouseholds,
    selectedHousehold: currentSelectedHousehold,
    recognized,
    declineIntent,
  } = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  // Pre-select when there's only one match (always the case for a recognized
  // guest), so they can confirm in a single tap.
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | undefined>(() =>
    matchedHouseholds && matchedHouseholds.length === 1 ? matchedHouseholds[0]?.id : undefined
  )

  // "Not you" clears the invite-recognized match and sends the guest back to the
  // name search, in case they opened someone else's save-the-date link.
  const onNotYou = () => {
    updateRsvpForm({
      recognized: false,
      matchedHouseholds: [],
      selectedHousehold: undefined,
      rsvpResponses: [],
      answersToQuestions: [],
    })
    goBack?.()
  }

  const onContinue = () => {
    const selectedHousehold = matchedHouseholds?.find(
      (household: HouseholdSearchItem) => household.id === selectedHouseholdId
    )
    const primaryContact = selectedHousehold?.guests?.find(
      (guest: GuestWithInvitations) => guest.isPrimaryContact
    )
    const householdDidChange = selectedHouseholdId !== currentSelectedHousehold?.id
    updateRsvpForm(
      householdDidChange
        ? {
            selectedHousehold: Object.assign({ primaryContact }, selectedHousehold),
            rsvpResponses: [],
            answersToQuestions: [],
          }
        : {
            selectedHousehold: Object.assign({ primaryContact }, selectedHousehold),
          }
    )
    goNext?.()
  }

  return (
    <StepShell>
      <StepHeading>
        {recognized
          ? t('recognizedInvitation')
          : declineIntent
            ? t('foundInGuestListDecline')
            : t('foundInGuestList')}
      </StepHeading>
      <div className='flex flex-col gap-3'>
        {matchedHouseholds?.map((household: HouseholdSearchItem) => {
          const isSelected = selectedHouseholdId === household.id
          return (
            <label
              key={household.id}
              htmlFor={household.id}
              className={`flex min-h-12 cursor-pointer items-center gap-4 rounded-[16px] border px-5 py-4 text-base transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-foreground/80 hover:border-primary/50'
              }`}
            >
              <input
                type='radio'
                id={household.id}
                checked={isSelected}
                onChange={() => setSelectedHouseholdId(household.id)}
                className='h-5 w-5 accent-primary'
              />
              {household.guests
                ?.map((guest: GuestWithInvitations) => `${guest.firstName} ${guest.lastName}`)
                .join(', ')}
            </label>
          )
        })}
      </div>

      <StepActions>
        <StepPrimaryButton disabled={selectedHouseholdId === undefined} onClick={onContinue}>
          {tCommon('continue')}
        </StepPrimaryButton>
        <StepSecondaryButton onClick={recognized ? onNotYou : () => goBack?.()}>
          {recognized ? t('notYou') : t('searchAgain')}
        </StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}
