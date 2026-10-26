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
import { api } from '~/trpc/react'

type HouseholdSearchItem = HouseholdSearch[number]
type GuestWithInvitations = HouseholdSearchItem['guests'][number]

type ConfirmNameFormProps = StepFormProps & {
  /** Proves the guest already cleared this website's password gate, if any. */
  accessToken?: string
}

export default function ConfirmNameForm({ goNext, goBack, accessToken }: ConfirmNameFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const {
    matchedHouseholds,
    selectedHousehold: currentSelectedHousehold,
    recognized,
    declineIntent,
    searchText,
    weddingData,
  } = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  // Pre-select when there's only one match (always the case for a recognized
  // guest), so they can confirm in a single tap.
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | undefined>(() =>
    matchedHouseholds && matchedHouseholds.length === 1 ? matchedHouseholds[0]?.id : undefined
  )

  const subUrl = weddingData.website?.subUrl ?? ''

  // Dietary notes and the wishes message are withheld from the name search
  // itself (see publicRsvpHouseholdSelect) and only released here, once the
  // guest has picked a specific household, by re-checking `searchText`
  // against that household server-side.
  const { refetch: refetchDetails, isFetching: isFetchingDetails } =
    api.household.getPublicHouseholdDetails.useQuery(
      {
        subUrl,
        householdId: selectedHouseholdId ?? '',
        searchText: searchText ?? '',
        accessToken,
      },
      { enabled: false, retry: false }
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

  const onContinue = async () => {
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

    // No searchText means the household was resolved from a save-the-date
    // cookie rather than a name search, so there's nothing to re-prove
    // identity with — the dietary-notes/wishes-message steps simply stay
    // blank for that guest, as before this fetch existed.
    if (searchText && selectedHouseholdId) {
      const detailsResult = await refetchDetails()
      if (detailsResult.data) {
        updateRsvpForm({
          dietaryNotes: detailsResult.data.dietaryNotes ?? undefined,
          wishesMessage: detailsResult.data.wishesMessage ?? undefined,
        })
      }
    }

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
        <StepPrimaryButton
          disabled={selectedHouseholdId === undefined || isFetchingDetails}
          onClick={onContinue}
        >
          {tCommon('continue')}
        </StepPrimaryButton>
        <StepSecondaryButton onClick={recognized ? onNotYou : () => goBack?.()}>
          {recognized ? t('notYou') : t('searchAgain')}
        </StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}
