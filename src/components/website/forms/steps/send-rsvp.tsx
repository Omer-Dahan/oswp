'use client'

import { useTranslations } from 'next-intl'
import type { StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm } from '~/components/contexts/rsvp-form-context'
import {
  StepActions,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
} from '~/components/website/forms/steps/step-ui'

interface SendRsvpProps extends StepFormProps {
  isFetching: boolean
}

export default function SendRsvp({ goBack, isFetching }: SendRsvpProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const { weddingData } = useRsvpForm()

  return (
    <StepShell>
      <StepHeading>
        {t('sendRsvpTitle', {
          groomFirstName: weddingData.groomFirstName ?? '',
          brideFirstName: weddingData.brideFirstName ?? '',
        })}
      </StepHeading>
      <StepActions>
        <StepPrimaryButton disabled={isFetching} type='submit'>
          {t('sendRsvp')}
        </StepPrimaryButton>
        <StepSecondaryButton onClick={() => goBack?.()}>{tCommon('back')}</StepSecondaryButton>
      </StepActions>
      <p className='text-center text-muted-foreground text-sm underline underline-offset-4'>
        {tCommon('privacyPolicy')}
      </p>
    </StepShell>
  )
}
