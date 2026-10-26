'use client'

import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { IoMdClose } from 'react-icons/io'
import type { Event, Question, RsvpPageData } from '~/app/utils/shared-types'
import { useRsvpForm, useUpdateRsvpForm } from '~/components/contexts/rsvp-form-context'
import { useConfirmReloadPage } from '~/components/hooks'
import { AsyncState } from '~/components/ui/async-state'
import MultistepRsvpForm from '~/components/website/forms/multi-step-form'
import ChildrenCountForm from '~/components/website/forms/steps/children-count'
import ConfirmNameForm from '~/components/website/forms/steps/confirm-name'
import DeclineConfirmForm from '~/components/website/forms/steps/decline-confirm'
import DietaryNotesForm from '~/components/website/forms/steps/dietary-notes'
import EventRsvpForm from '~/components/website/forms/steps/event-rsvp'
import FindYourInvitationForm from '~/components/website/forms/steps/find-your-invitation'
import QuestionMultipleChoice from '~/components/website/forms/steps/question-multiple-choice'
import QuestionShortAnswer from '~/components/website/forms/steps/question-short-answer'
import SendRsvp from '~/components/website/forms/steps/send-rsvp'
import WhoIsComingForm from '~/components/website/forms/steps/who-is-coming'
import WishesMessageForm from '~/components/website/forms/steps/wishes-message'
import RsvpConfirmation from '~/components/website/rsvp-confirmation'
import { ANALYTICS_ACTIONS, ANALYTICS_SCOPES, buildEventName } from '~/lib/analytics/events'
import { track } from '~/lib/analytics/track'
import { api } from '~/trpc/react'

const RSVP_SUBMISSION_EVENT = buildEventName({
  scope: ANALYTICS_SCOPES.rsvp,
  object: 'public_submission',
  action: ANALYTICS_ACTIONS.started,
})

type MainRsvpFormProps = {
  weddingData: RsvpPageData
  basePath: string
  /** Place progress below the surrounding site's persistent navigation. */
  embedded?: boolean
  /** Proves the guest already cleared this website's password gate, if any. */
  accessToken?: string
}

// find invitation, confirm household, who-is-coming, children-count,
// dietary-notes, wishes-message, final step, and confirmation
const NUM_STATIC_STEPS = 8

// The short decline-intent flow (`?decline=1`): find invitation, confirm
// household, a single decline confirmation, wishes-message, final step, and
// confirmation — it skips who-is-coming/children/dietary/per-event steps
// entirely.
const NUM_DECLINE_STEPS = 6

export const shouldConfirmRsvpClose = ({
  currentStep,
  numSteps,
}: {
  currentStep: number
  numSteps: number
}) => currentStep > 1 && currentStep < numSteps

export default function MainRsvpForm({
  weddingData,
  basePath,
  embedded = false,
  accessToken,
}: MainRsvpFormProps) {
  const tCommon = useTranslations('common')
  const rsvpFormData = useRsvpForm()
  const isDeclineFlow = rsvpFormData.declineIntent === true
  const updateRsvpForm = useUpdateRsvpForm()
  // A recognized guest (identified by their save-the-date invite) skips the name
  // search and lands on the confirm step (step 2).
  const [currentStep, setCurrentStep] = useState<number>(rsvpFormData.recognized ? 2 : 1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  useEffect(() => {
    updateRsvpForm({ weddingData })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateRsvpForm, weddingData])

  const submitRsvpForm = api.website.submitPublicRsvpForm.useMutation({
    onSuccess: () => {
      setSubmitError(null)
      setCurrentStep((prev) => prev + 1)
    },
    onError: (err) => {
      console.error('Failed to submit RSVP', err)
      setSubmitError(tCommon('submitError'))
    },
  })

  const dynamicStepForms = useMemo((): ReactNode[] => {
    // "Who is coming" already asks attendance for the only event in play
    // (a single collectRsvp event, or one narrowed down by
    // preselectedEventId), so asking again in a dedicated event step would
    // repeat the same question. That per-event step is only needed when the
    // guest must answer for more than one event.
    const relevantEventsCount =
      weddingData?.events?.filter(
        (event) =>
          event.collectRsvp &&
          (!rsvpFormData.preselectedEventId || event.id === rsvpFormData.preselectedEventId)
      ).length ?? 0
    const isSingleEventFlow = relevantEventsCount <= 1

    const newSteps: ReactNode[] =
      weddingData?.events?.reduce((acc: ReactNode[], event: Event) => {
        if (!event.collectRsvp) return acc
        if (rsvpFormData.preselectedEventId && event.id !== rsvpFormData.preselectedEventId) {
          return acc
        }
        const invitedGuests = rsvpFormData.selectedHousehold?.guests.filter((guest) =>
          guest.invitations.some(
            (invite) =>
              invite.eventId === event.id &&
              ['Invited', 'Attending', 'Declined'].includes(invite.rsvp ?? '')
          )
        )

        if (invitedGuests !== undefined && invitedGuests.length > 0) {
          if (!isSingleEventFlow) {
            acc.push(<EventRsvpForm event={event} invitedGuests={invitedGuests} />)
          }
          // Only show question steps for guests who confirmed attendance.
          // Fall back to all invited guests if responses haven't been recorded yet.
          const hasResponsesForEvent = rsvpFormData.rsvpResponses.some(
            (r) => r.eventId === event.id
          )
          const guestsForQuestions = hasResponsesForEvent
            ? invitedGuests.filter((guest) =>
                rsvpFormData.rsvpResponses.some(
                  (r) => r.guestId === guest.id && r.eventId === event.id && r.rsvp === 'Attending'
                )
              )
            : invitedGuests
          for (const question of event.questions) {
            guestsForQuestions.forEach((guest) => {
              if (question.type === 'Text') {
                acc.push(<QuestionShortAnswer question={question} guest={guest} />)
              } else {
                acc.push(<QuestionMultipleChoice question={question} guest={guest} />)
              }
            })
          }
        }
        return acc
      }, []) ?? []

    weddingData?.website?.generalQuestions?.forEach((question: Question) => {
      if (question.type === 'Text') {
        newSteps.push(<QuestionShortAnswer question={question} />)
      } else {
        newSteps.push(<QuestionMultipleChoice question={question} />)
      }
    })

    return newSteps
  }, [
    weddingData,
    rsvpFormData.selectedHousehold,
    rsvpFormData.rsvpResponses,
    rsvpFormData.preselectedEventId,
  ])

  const numSteps = isDeclineFlow
    ? NUM_DECLINE_STEPS
    : dynamicStepForms.length + NUM_STATIC_STEPS
  const progress = (currentStep / numSteps) * 100
  useConfirmReloadPage(currentStep > 1 && currentStep < numSteps)

  return (
    // pt-24 reserves space for the fixed ProgressBar so the first step's copy
    // isn't hidden beneath it. No font utility here: the template's own body
    // face (--tpl-body-font / Mesheq for Hebrew) already cascades in from
    // TemplateThemeProvider, same as every other guest surface.
    <div className={`${embedded ? 'pt-6' : 'pt-24'} pb-20`}>
      <ProgressBar
        currentStep={currentStep}
        progress={progress}
        numSteps={numSteps}
        basePath={basePath}
        embedded={embedded}
      />
      <form
        className='m-auto w-full max-w-[450px] px-5 py-8 md:px-0'
        onSubmit={(e) => {
          e.preventDefault()

          // Only the send-rsvp step's button is type='submit'; every other step
          // uses type='button' and calls goNext() directly. But a lone text
          // input still triggers the browser's implicit form submission on
          // Enter/Go, which would otherwise reach this handler mid-flow with
          // stale or incomplete form state. Guard so submission only proceeds
          // from that final step.
          if (currentStep !== numSteps - 1) return

          setSubmitError(null)

          const subUrl = weddingData.website?.subUrl
          const householdId = rsvpFormData.selectedHousehold?.id

          if (!subUrl || !householdId) {
            setSubmitError(tCommon('genericError'))
            return
          }

          // The guest reaches this page from the wedding website (or their
          // save-the-date link), so the submission is scoped by subUrl. An
          // optional ?token= from a shared self-fill link is still forwarded when
          // present.
          const token = new URLSearchParams(window.location.search).get('token') ?? undefined

          // Analytics: record the guest's RSVP submission from the template.
          // The backend also captures the persisted outcome; this frontend event
          // carries the rich client context (household, response payload) that we
          // keep as a temporary backup while the app is being tested.
          track(
            RSVP_SUBMISSION_EVENT,
            {
              weddingId: weddingData.events?.[0]?.weddingId,
              token,
              householdId: rsvpFormData.selectedHousehold?.id,
              subUrl,
            },
            {
              num_event_responses: rsvpFormData.rsvpResponses.length,
              num_question_answers: rsvpFormData.answersToQuestions.length,
              payload: {
                rsvpResponses: rsvpFormData.rsvpResponses,
                answersToQuestions: rsvpFormData.answersToQuestions,
              },
            }
          )

          submitRsvpForm.mutate({
            subUrl,
            householdId,
            ...(token ? { token } : {}),
            attendingCount: rsvpFormData.attendingCount,
            childrenCount: rsvpFormData.childrenCount,
            dietaryNotes: rsvpFormData.dietaryNotes,
            wishesMessage: rsvpFormData.wishesMessage,
            extraGuestNames: rsvpFormData.extraGuestNames ?? [],
            rsvpResponses: rsvpFormData.rsvpResponses.map((response) => ({
              eventId: response.eventId,
              guestId: response.guestId,
              // RsvpSelection only ever produces these two values; narrowed here
              // since the public submission schema requires the literal union.
              rsvp: response.rsvp as 'Attending' | 'Declined',
            })),
            answersToQuestions: rsvpFormData.answersToQuestions,
          })
        }}
      >
        <AsyncState error={submitError} className='mb-4 text-center' />
        <MultistepRsvpForm currentStep={currentStep} setCurrentStep={setCurrentStep}>
          <FindYourInvitationForm accessToken={accessToken} />
          <ConfirmNameForm />
          {isDeclineFlow ? (
            <DeclineConfirmForm />
          ) : (
            [
              <WhoIsComingForm key='who-is-coming' />,
              <ChildrenCountForm key='children-count' />,
              <DietaryNotesForm key='dietary-notes' />,
              ...dynamicStepForms,
            ]
          )}
          <WishesMessageForm />
          <SendRsvp isFetching={submitRsvpForm.isPending} />
          <RsvpConfirmation basePath={basePath} />
        </MultistepRsvpForm>
      </form>
    </div>
  )
}

const ProgressBar = ({
  currentStep,
  progress,
  numSteps,
  basePath,
  embedded,
}: {
  currentStep: number
  progress: number
  numSteps: number
  basePath: string
  embedded: boolean
}) => {
  const tCommon = useTranslations('common')
  return (
    <div
      className={`${embedded ? 'relative mx-auto max-w-xl' : 'fixed top-0 z-10'} w-full bg-background px-10 py-3 text-center`}
    >
      <button
        type='button'
        aria-label='סגרו טופס RSVP'
        className='absolute end-20 top-3 z-20 rounded-md text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        onClick={() => {
          if (
            !shouldConfirmRsvpClose({ currentStep, numSteps }) ||
            window.confirm('האם אתם בטוחים? ה-RSVP שלכם לא נשלח.')
          ) {
            window.location.href = basePath
          }
        }}
      >
        <IoMdClose size={22} />
      </button>
      <p className='py-2 font-[family-name:var(--tpl-body-font)] text-foreground text-lg tracking-wide'>
        {tCommon('rsvpFormTitle')}
      </p>
      <div className='relative h-1 w-full overflow-hidden rounded-full bg-border'>
        <div
          className='absolute start-0 top-0 h-1 rounded-full bg-primary transition-[width]'
          style={{
            width: currentStep < 3 ? '3%' : currentStep === numSteps - 1 ? '99%' : `${progress}%`,
          }}
        ></div>
      </div>
    </div>
  )
}
