'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { IoIosCheckmarkCircleOutline } from 'react-icons/io'
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

interface QuestionMultipleChoiceProps extends StepFormProps {
  guest?: Guest
  question: Question
}

export default function QuestionMultipleChoice({
  goNext,
  goBack,
  guest,
  question,
}: QuestionMultipleChoiceProps) {
  const t = useTranslations('questions')
  const tCommon = useTranslations('common')
  const OTHER_OPTION_ID = '__other__'
  const rsvpFormData = useRsvpForm()
  const updateRsvpForm = useUpdateRsvpForm()
  const questionId = question.id ?? '-1'
  // General/website questions are asked once for the whole household and have no
  // specific guest. Attribute them to the household's primary contact (falling
  // back to any household guest) so the response references a real Guest and
  // satisfies the OptionResponse_guestId foreign key.
  const householdGuestId =
    rsvpFormData.selectedHousehold?.primaryContact?.id ??
    rsvpFormData.selectedHousehold?.guests?.[0]?.id
  const answerTarget = {
    questionId,
    guestId: guest?.id ?? householdGuestId,
    householdId: rsvpFormData.selectedHousehold?.id,
  }
  const existingAnswer = findExistingAnswer(rsvpFormData.answersToQuestions, answerTarget)
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(() => {
    if (!existingAnswer) return undefined
    if (existingAnswer.questionType === 'Text') {
      return question.allowOther ? OTHER_OPTION_ID : undefined
    }
    return existingAnswer.response
  })
  const [otherResponse, setOtherResponse] = useState<string>(
    existingAnswer?.questionType === 'Text' ? existingAnswer.response : ''
  )
  const isOtherSelected = question.allowOther === true && selectedOptionId === OTHER_OPTION_ID
  const canContinue =
    selectedOptionId !== undefined && (!isOtherSelected || otherResponse.trim().length > 0)

  return (
    <StepShell>
      <StepHeading>{question.text}</StepHeading>
      {!!guest && (
        <span className='text-base text-muted-foreground'>
          {guest.firstName} {guest.lastName}
        </span>
      )}
      <ul className='flex flex-col gap-3'>
        {question.options?.map((option) => (
          <li key={option.id}>
            <OptionButton
              isSelected={selectedOptionId === option.id}
              onClick={() => setSelectedOptionId(option.id)}
              title={option.text}
              description={option.description}
            />
          </li>
        ))}
        {question.allowOther ? (
          <li>
            <OptionButton
              isSelected={isOtherSelected}
              onClick={() => setSelectedOptionId(OTHER_OPTION_ID)}
              title={t('other')}
              description={t('otherDescription')}
            />
          </li>
        ) : null}
      </ul>
      {isOtherSelected && (
        <StepTextArea
          placeholder={t('otherPlaceholder')}
          value={otherResponse}
          onChange={(event) => setOtherResponse(event.target.value)}
          rows={3}
        />
      )}
      <StepActions>
        <StepPrimaryButton
          disabled={!canContinue}
          onClick={() => {
            const nextAnswer: AnswerWithType = {
              ...answerTarget,
              questionType: isOtherSelected ? 'Text' : 'Option',
              response: isOtherSelected ? otherResponse.trim() : (selectedOptionId ?? ''),
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
        <StepSecondaryButton type='submit' onClick={() => goBack?.()}>
          {tCommon('back')}
        </StepSecondaryButton>
      </StepActions>
    </StepShell>
  )
}

function OptionButton({
  isSelected,
  onClick,
  title,
  description,
}: {
  isSelected: boolean
  onClick: () => void
  title: string
  description?: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`relative w-full rounded-[16px] border px-5 py-4 text-start transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      <div className='flex flex-col gap-1 pe-8'>
        <p className='font-[family-name:var(--tpl-body-font)] text-base text-foreground'>
          {title}
        </p>
        {description ? <p className='text-muted-foreground text-sm'>{description}</p> : null}
      </div>
      {isSelected && (
        <div className='absolute top-1/2 end-5 -translate-y-1/2 text-primary'>
          <IoIosCheckmarkCircleOutline size={22} aria-hidden />
        </div>
      )}
    </button>
  )
}
