'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import {
  StepActions,
  StepBody,
  StepErrorText,
  StepField,
  StepHeading,
  StepPrimaryButton,
  StepShell,
  StepTextInput,
} from '~/components/website/forms/steps/step-ui'
import { api } from '~/trpc/react'

type FindYourInvitationFormProps = StepFormProps & {
  /** Proves the guest already cleared this website's password gate, if any. */
  accessToken?: string
}

export default function FindYourInvitationForm({
  goNext,
  accessToken,
}: FindYourInvitationFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const { weddingData, declineIntent } = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  const [name, setName] = useState<string>('')
  const [showError, setShowError] = useState<boolean>(false)

  const subUrl = weddingData.website?.subUrl ?? ''

  const { refetch, isFetching } = api.household.findBySearchPublic.useQuery(
    { subUrl, searchText: name, accessToken },
    {
      enabled: false,
      retry: false,
    }
  )

  const handleOnSearch = () => {
    // the method to conditionally execute client db queries?
    void refetch().then((res) => {
      // Only advance when the search actually returned households. Guarding on
      // presence (not just length) keeps an errored or empty response on this
      // step showing the retry hint, instead of dropping the guest onto a blank
      // confirm screen with no names to pick.
      if (res.error || !res.data || res.data.length === 0) {
        setShowError(true)
      } else {
        updateRsvpForm({ matchedHouseholds: res.data })
        goNext?.()
      }
    })
  }

  return (
    <StepShell>
      <StepHeading>
        {t('weddingTitle', {
          brideFirstName: weddingData.brideFirstName ?? '',
          groomFirstName: weddingData.groomFirstName ?? '',
        })}
      </StepHeading>
      <StepBody>{declineIntent ? t('groupNoteDecline') : t('groupNote')}</StepBody>
      <StepField label={t('fullNamePlaceholder')} htmlFor='rsvp-guest-name'>
        <StepTextInput
          id='rsvp-guest-name'
          placeholder={t('fullNamePlaceholder')}
          onChange={(e) => {
            setShowError(false)
            setName(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (name.length > 0 && !isFetching) handleOnSearch()
          }}
          value={name}
          enterKeyHint='search'
        />
      </StepField>
      {showError && <StepErrorText>{t('notFound')}</StepErrorText>}
      <StepActions>
        <StepPrimaryButton disabled={name.length === 0 || isFetching} onClick={handleOnSearch}>
          {isFetching ? tCommon('searching') : t('findInvitation')}
        </StepPrimaryButton>
      </StepActions>
    </StepShell>
  )
}
