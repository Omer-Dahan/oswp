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

const MAX_WISHES_MESSAGE_LENGTH = 1000

export default function WishesMessageForm({ goNext, goBack }: StepFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()

  const [wishesMessage, setWishesMessage] = useState<string>(
    () => rsvpFormData.wishesMessage ?? ''
  )

  const onContinue = () => {
    updateRsvpForm({ wishesMessage })
    goNext?.()
  }

  return (
    <StepShell>
      <StepHeading>{t('wishesMessageTitle')}</StepHeading>
      <StepField label={t('wishesMessageHelper')} htmlFor='wishes-message'>
        <StepTextArea
          id='wishes-message'
          rows={4}
          maxLength={MAX_WISHES_MESSAGE_LENGTH}
          placeholder={t('wishesMessagePlaceholder')}
          value={wishesMessage}
          onChange={(event) =>
            setWishesMessage(event.target.value.slice(0, MAX_WISHES_MESSAGE_LENGTH))
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
