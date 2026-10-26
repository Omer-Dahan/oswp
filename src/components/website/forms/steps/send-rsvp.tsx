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
  const { weddingData, declineIntent, attendingCount, childrenCount, dietaryNotes } =
    useRsvpForm()
  const isDeclineFlow = declineIntent === true

  const summaryRows = isDeclineFlow
    ? []
    : [
        attendingCount != null ? t('summaryAttending', { count: attendingCount }) : null,
        childrenCount != null && childrenCount > 0
          ? t('summaryChildren', { count: childrenCount })
          : null,
        dietaryNotes ? t('summaryDietary', { notes: dietaryNotes }) : null,
      ].filter((row): row is string => row != null)

  return (
    <StepShell>
      <StepHeading>
        {isDeclineFlow
          ? t('sendRsvpTitle', {
              groomFirstName: weddingData.groomFirstName ?? '',
              brideFirstName: weddingData.brideFirstName ?? '',
            })
          : t('summaryTitle')}
      </StepHeading>
      {summaryRows.length > 0 && (
        <ul className='flex flex-col gap-3'>
          {summaryRows.map((row) => (
            <li
              key={row}
              className='flex items-center justify-between gap-3 rounded-[16px] border border-border px-5 py-4'
            >
              <span className='text-base text-foreground'>{row}</span>
              <button
                type='button'
                onClick={() => goBack?.()}
                className='shrink-0 text-primary text-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              >
                {t('summaryEdit')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <StepActions>
        <StepPrimaryButton disabled={isFetching} type='submit'>
          {isFetching ? t('sendingRsvp') : isDeclineFlow ? t('sendRsvpDecline') : t('sendRsvp')}
        </StepPrimaryButton>
        <StepSecondaryButton onClick={() => goBack?.()}>{tCommon('back')}</StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}
