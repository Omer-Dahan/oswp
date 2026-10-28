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
import FindYourInvitationForm from '~/components/website/forms/steps/find-your-invitation'
import QuestionMultipleChoice from '~/components/website/forms/steps/question-multiple-choice'
import QuestionShortAnswer from '~/components/website/forms/steps/question-short-answer'
import SendRsvp from '~/components/website/forms/steps/send-rsvp'
import WhoIsComingForm from '~/components/website/forms/steps/who-is-coming'
import WishesMessageForm from '~/components/website/forms/steps/wishes-message'
import RsvpConfirmation from '~/components/website/rsvp-confirmation'
import { ANALYTICS_ACTIONS, ANALYTICS_SCOPES, buildEventName } from '~/lib/analytics/events'
import { track } from '~/lib/analytics/track'
import { getScopedRsvpSteps, type RsvpStepKey } from '~/lib/rsvp/steps'
import { isChuppahOnlySelection } from '~/lib/wedding/rsvp-events'
import { api } from '~/trpc/react'

const RSVP_SUBMISSION_EVENT = buildEventName({
  scope: ANALYTICS_SCOPES.rsvp,
  object: 'public_submission',
  action: ANALYTICS_ACTIONS.started,
})

const RSVP_STEP_COMPONENTS = {
  'children-count': ChildrenCountForm,
  'dietary-notes': DietaryNotesForm,
  'wishes-message': WishesMessageForm,
} as const

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

// The short decline-intent flow (`?decline=1`): find invitation, confirm
// household, a single decline confirmation that submits immediately, and the
// confirmation screen. It skips all attendance-detail and send steps.

const HEBREW_CHARACTERS = /[֐-׿]/

/**
 * Server-thrown TRPCErrors on this flow are a mix of guest-facing Hebrew
 * copy (safe to show as-is) and technical messages — raw zod validation
 * JSON, or English messages meant for developers, not guests. Only the
 * former should ever reach the guest; everything else falls back to a
 * generic Hebrew message.
 */
function getRsvpSubmitErrorMessage(
  err: { message?: string; data?: { code?: string; zodError?: unknown } | null },
  fallback: string
): string {
  if (err.data?.zodError || err.data?.code === 'BAD_REQUEST') {
    return fallback
  }
  if (err.data?.code === 'TOO_MANY_REQUESTS') {
    return err.message || fallback
  }
  if (err.message && HEBREW_CHARACTERS.test(err.message)) {
    return err.message
  }
  return fallback
}

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
  // A guest arriving from their personal save-the-date link is already known:
  // asking them to search for themselves and then to re-confirm who they are is
  // two screens of nothing, so the flow starts straight at "who is coming".
  const skipIdentitySteps = rsvpFormData.recognized === true
  const [currentStep, setCurrentStep] = useState<number>(1)
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
      setSubmitError(getRsvpSubmitErrorMessage(err, tCommon('submitError')))
    },
  })

  const dynamicStepForms = useMemo((): ReactNode[] => {
    // "Who is coming" already asks attendance for the only event in play
    // (a single collectRsvp event, or one narrowed down by
    // preselectedEventId), so asking again in a dedicated event step would
    // repeat the same question. That per-event step is only needed when the
    // guest must answer for more than one event.
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
          // Attendance for every event is already collected on the
          // who-is-coming screen (one toggle per guest covers all their
          // invitations), so there is no separate per-event step.
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

  // The chuppah is a ceremony, not a meal: when the guest answers for the
  // chuppah alone there is nothing to collect about children or food, and those
  // two steps only make the form longer and more confusing. The step count has
  // to shrink with them or the progress bar ends at 75%.
  const isChuppahOnlyFlow = useMemo(
    () => isChuppahOnlySelection(weddingData?.events ?? [], rsvpFormData.preselectedEventId),
    [weddingData?.events, rsvpFormData.preselectedEventId]
  )
  const configuredRsvpSteps = useMemo(() => {
    const invitedEventIds = new Set(
      rsvpFormData.selectedHousehold?.guests.flatMap((guest) =>
        (guest.invitations ?? [])
          .filter((invite) => ['Invited', 'Attending', 'Declined'].includes(invite.rsvp ?? ''))
          .map((invite) => invite.eventId)
      ) ?? []
    )
    const scoped = getScopedRsvpSteps({
      weddingSteps: weddingData.rsvpSteps,
      events: weddingData.events ?? [],
      preselectedEventId: rsvpFormData.preselectedEventId,
      invitedEventIds,
    })
    return isChuppahOnlyFlow
      ? scoped.filter((step) => step !== 'children-count' && step !== 'dietary-notes')
      : scoped
  }, [
    isChuppahOnlyFlow,
    rsvpFormData.preselectedEventId,
    rsvpFormData.selectedHousehold,
    weddingData.events,
    weddingData.rsvpSteps,
  ])
  const configuredRsvpStepSet = useMemo(
    () => new Set<RsvpStepKey>(configuredRsvpSteps),
    [configuredRsvpSteps]
  )

  // Counted from the rendered list rather than a magic constant: the flow now
  // ends without a wishes step, and the chuppah-only variant skips the two meal
  // steps, so a fixed number drifts out of sync with the progress bar.
  const identitySteps = skipIdentitySteps ? 0 : 2 // find, confirm
  const numSteps = isDeclineFlow
    ? identitySteps + 2 // decline confirmation, confirmation
    : identitySteps +
      1 + // who is coming
      configuredRsvpSteps.length +
      dynamicStepForms.length +
      2 // send, confirmation
  const progress = (currentStep / numSteps) * 100
  // With no identity steps in front, the "who is coming" screen IS the first
  // step and nothing has been typed yet, so leaving it needs no confirmation.
  useConfirmReloadPage(currentStep > Math.max(1, identitySteps) && currentStep < numSteps)

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
        identityStepCount={identitySteps}
        basePath={basePath}
        embedded={embedded}
        isDeclineFlow={isDeclineFlow}
      />
      <form
        className='m-auto w-full max-w-[450px] px-5 py-8 md:px-0'
        onSubmit={(e) => {
          e.preventDefault()

          // The attending flow submits from its send step; the decline flow
          // submits from its sole question. A lone text input can still trigger
          // implicit submission on Enter/Go, so only the penultimate rendered
          // step may reach the mutation.
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
            // A chuppah-only answer says nothing about the meal: sending the
            // household's counts from that narrower view would overwrite the
            // numbers collected for the wedding itself.
            attendingCount: isChuppahOnlyFlow ? undefined : rsvpFormData.attendingCount,
            childrenCount: configuredRsvpStepSet.has('children-count')
              ? rsvpFormData.childrenCount
              : undefined,
            dietaryNotes: configuredRsvpStepSet.has('dietary-notes')
              ? rsvpFormData.dietaryNotes
              : undefined,
            wishesMessage: configuredRsvpStepSet.has('wishes-message')
              ? rsvpFormData.wishesMessage
              : undefined,
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
          {!skipIdentitySteps && <FindYourInvitationForm accessToken={accessToken} />}
          {!skipIdentitySteps && <ConfirmNameForm accessToken={accessToken} />}
          {isDeclineFlow ? (
            <DeclineConfirmForm />
          ) : (
            [
              <WhoIsComingForm key='who-is-coming' />,
              ...configuredRsvpSteps.map((step) => {
                const StepComponent = RSVP_STEP_COMPONENTS[step]
                return <StepComponent key={step} />
              }),
              ...dynamicStepForms,
            ]
          )}
          {!isDeclineFlow && <SendRsvp isFetching={submitRsvpForm.isPending} />}
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
  identityStepCount,
  basePath,
  embedded,
  isDeclineFlow,
}: {
  currentStep: number
  progress: number
  numSteps: number
  identityStepCount: number
  basePath: string
  embedded: boolean
  isDeclineFlow: boolean
}) => {
  const tCommon = useTranslations('common')
  return (
    <div
      className={`${embedded ? 'relative mx-auto max-w-xl' : 'fixed top-0 z-10'} w-full bg-background px-10 py-3 text-center`}
    >
      <button
        type='button'
        aria-label='סגרו טופס RSVP'
        className='absolute end-[4.25rem] top-0 z-20 flex h-11 w-11 items-center justify-center rounded-md text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
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
            width:
              currentStep <= identityStepCount
                ? '3%'
                : currentStep === numSteps
                  ? '100%'
                  : currentStep === numSteps - 1 && !isDeclineFlow
                    ? '99%'
                    : `${progress}%`,
          }}
        ></div>
      </div>
    </div>
  )
}
