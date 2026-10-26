'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { Guest, Question, StepFormProps } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import {
  type AnswerWithType,
  findExistingAnswer,
  removeAnswer,
  upsertAnswer,
} from '~/components/website/forms/rsvp-state'
import {
  StepActions,
  StepHeading,
  StepPrimaryButton,
  StepSecondaryButton,
  StepShell,
  StepTextArea,
} from '~/components/website/forms/steps/step-ui'

interface QuestionShortAnswerProps extends StepFormProps {
  guest?: Guest
  question: Question
}

export default function QuestionShortAnswer({
  goNext,
  goBack,
  guest,
  question,
}: QuestionShortAnswerProps) {
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  const questionId = question.id ?? '-1'
  // General/website questions are asked once for the whole household and have no
  // specific guest. Attribute them to the household's primary contact (falling
  // back to any household guest) so the answer references a real Guest and
  // satisfies the Answer_guestId foreign key.
  const householdGuestId =
    rsvpFormData.selectedHousehold?.primaryContact?.id ??
    rsvpFormData.selectedHousehold?.guests?.[0]?.id
  const answerTarget = {
    questionId,
    guestId: guest?.id ?? householdGuestId,
    householdId: rsvpFormData.selectedHousehold?.id,
  }
  const existingAnswer = findExistingAnswer(rsvpFormData.answersToQuestions, answerTarget)
  const [answer, setAnswer] = useState(existingAnswer?.response ?? '')

  return (
    <StepShell>
      <StepHeading>{question.text}</StepHeading>
      {!!guest && (
        <span className='text-base text-muted-foreground'>
          {guest.firstName} {guest.lastName}
        </span>
      )}
      <StepTextArea value={answer} onChange={(e) => setAnswer(e.target.value)} className='h-40' />
      <StepActions>
        <StepPrimaryButton
          disabled={answer.length === 0}
          onClick={() => {
            const nextAnswer: AnswerWithType = {
              ...answerTarget,
              questionType: 'Text',
              response: answer,
              guestFirstName:
                guest?.firstName ?? rsvpFormData.selectedHousehold?.primaryContact?.firstName,
              guestLastName:
                guest?.lastName ?? rsvpFormData.selectedHousehold?.primaryContact?.lastName,
            }
            updateRsvpForm({
              answersToQuestions: upsertAnswer(rsvpFormData.answersToQuestions, nextAnswer),
            })
            goNext?.()
          }}
        >
          {tCommon('continue')}
        </StepPrimaryButton>
        {!question.isRequired && (
          <StepSecondaryButton
            onClick={() => {
              updateRsvpForm({
                answersToQuestions: removeAnswer(rsvpFormData.answersToQuestions, answerTarget),
              })
              goNext?.()
            }}
          >
            {tCommon('skip')}
          </StepSecondaryButton>
        )}
        <StepSecondaryButton onClick={() => goBack?.()}>
          {tCommon('back')}
        </StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}
