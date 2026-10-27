'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import {
  StepActions,
  StepField,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
  StepTextArea,
} from '~/components/website/forms/steps/step-ui'

const MAX_DIETARY_NOTES_LENGTH = 500

export default function DietaryNotesForm({ goNext, goBack }: StepFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()

  const [dietaryNotes, setDietaryNotes] = useState<string>(() => rsvpFormData.dietaryNotes ?? '')

  const onContinue = () => {
    const trimmed = dietaryNotes.trim()
    updateRsvpForm({ dietaryNotes: trimmed === '' ? null : trimmed })
    goNext?.()
  }

  return (
    <StepShell>
      <StepHeading>{t('dietaryNotesTitle')}</StepHeading>
      <StepField label={t('dietaryNotesHelper')} htmlFor='dietary-notes'>
        <StepTextArea
          id='dietary-notes'
          rows={4}
          maxLength={MAX_DIETARY_NOTES_LENGTH}
          value={dietaryNotes}
          onChange={(event) =>
            setDietaryNotes(event.target.value.slice(0, MAX_DIETARY_NOTES_LENGTH))
          }
        />
      </StepField>

      <StepActions>
        <StepPrimaryButton onClick={onContinue}>{tCommon('continue')}</StepPrimaryButton>
        <StepSecondaryButton onClick={() => goBack?.()}>{tCommon('back')}</StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}
