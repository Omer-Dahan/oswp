'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import { clampCount } from '~/components/website/forms/rsvp-state'
import {
  StepActions,
  StepBody,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
  StepStepperButton,
} from '~/components/website/forms/steps/step-ui'

const MIN_CHILDREN = 0
const MAX_CHILDREN = 10

export default function ChildrenCountForm({ goNext, goBack }: StepFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()

  const [childrenCount, setChildrenCount] = useState<number>(() =>
    clampCount(
      rsvpFormData.childrenCount ?? rsvpFormData.selectedHousehold?.childrenCount ?? 0,
      MIN_CHILDREN,
      MAX_CHILDREN
    )
  )

  const onContinue = () => {
    updateRsvpForm({ childrenCount })
    goNext?.()
  }

  return (
    <StepShell>
      <StepHeading>{t('childrenCountTitle')}</StepHeading>
      <StepBody>{t('childrenCountHelper')}</StepBody>

      <div className='flex items-center justify-center gap-6 py-4'>
        <StepStepperButton
          disabled={childrenCount <= MIN_CHILDREN}
          onClick={() =>
            setChildrenCount((value) => clampCount(value - 1, MIN_CHILDREN, MAX_CHILDREN))
          }
        >
          −
        </StepStepperButton>
        <span className='w-10 text-center text-3xl text-foreground tabular-nums'>
          {childrenCount}
        </span>
        <StepStepperButton
          disabled={childrenCount >= MAX_CHILDREN}
          onClick={() =>
            setChildrenCount((value) => clampCount(value + 1, MIN_CHILDREN, MAX_CHILDREN))
          }
        >
          +
        </StepStepperButton>
      </div>

      <StepActions>
        <StepPrimaryButton onClick={onContinue}>{tCommon('continue')}</StepPrimaryButton>
        <StepSecondaryButton onClick={() => goBack?.()}>{tCommon('back')}</StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}
