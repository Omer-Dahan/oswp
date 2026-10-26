'use client'

import { useTranslations } from 'next-intl'
import type { StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import {
  StepActions,
  StepBody,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
} from '~/components/website/forms/steps/step-ui'
import { upsertRsvpResponses } from '~/components/website/forms/rsvp-state'

/**
 * The short decline flow's only question step: a single, respectful
 * confirmation instead of the full who-is-coming / children / dietary /
 * per-event sequence. Confirming marks every guest in the household as
 * Declined for every event they're invited to.
 */
export default function DeclineConfirmForm({ goNext, goBack }: StepFormProps) {
  const t = useTranslations('rsvp')
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  const household = rsvpFormData.selectedHousehold

  const onConfirmDecline = () => {
    if (household) {
      const responses = household.guests.flatMap((guest) =>
        guest.invitations.map((invite) => ({
          eventId: invite.eventId,
          guestId: guest.id,
          guestName: `${guest.firstName} ${guest.lastName}`,
          rsvp: 'Declined' as const,
        }))
      )

      updateRsvpForm({
        rsvpResponses: upsertRsvpResponses(rsvpFormData.rsvpResponses, responses),
        attendingCount: 0,
        extraGuestNames: [],
        childrenCount: 0,
        dietaryNotes: '',
      })
    }
    goNext?.()
  }

  return (
    <StepShell>
      <StepHeading>{t('declineConfirmTitle')}</StepHeading>
      <StepBody>{t('declineConfirmBody')}</StepBody>
      <StepActions>
        <StepPrimaryButton onClick={onConfirmDecline}>
          {t('declineConfirmButton')}
        </StepPrimaryButton>
        <StepSecondaryButton onClick={() => goBack?.()}>{tCommon('back')}</StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}
