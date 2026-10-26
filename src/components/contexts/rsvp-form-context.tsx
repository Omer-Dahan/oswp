'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'

import type {
  Guest,
  HouseholdSearch,
  Invitation,
  RsvpFormResponse,
  RsvpPageData,
} from '~/app/utils/shared-types'
import type { AnswerWithType } from '~/components/website/forms/rsvp-state'

type H = HouseholdSearch[0]
interface SelectedHousehold extends H {
  id: string
  primaryContact: Guest | undefined
  guests: Array<Guest & { invitations: Invitation[] }>
}

type RsvpFormState = {
  matchedHouseholds?: HouseholdSearch
  /**
   * The name the guest searched with, set on the find-your-invitation step.
   * Re-used to re-prove identity when fetching a selected household's
   * private fields (dietary notes, wishes message).
   */
  searchText?: string
  selectedHousehold?: SelectedHousehold
  rsvpResponses: RsvpFormResponse[]
  answersToQuestions: AnswerWithType[]
  weddingData: Partial<RsvpPageData>
  /** Total household party size (named guests + unnamed extras), set on the who-is-coming step. */
  attendingCount?: number
  /** Names of the "extra" guests added by name on the who-is-coming step. */
  extraGuestNames?: string[]
  /** Children under 10 attending, set on the children-count step. */
  childrenCount?: number
  /** Free-text dietary notes for the household, set on the dietary-notes step. */
  dietaryNotes?: string
  /** Free-text wishes/congratulations message for the couple, set on the wishes-message step. */
  wishesMessage?: string
  /**
   * True when the guest was identified from their save-the-date invite cookie,
   * so the flow starts on the confirm step (skipping the name search) and offers
   * a "Not you" escape back to search.
   */
  recognized?: boolean
  /** Event preselected via `?event=` on the RSVP link (e.g. the home's per-event pills). */
  preselectedEventId?: string
  /**
   * Set via `?decline=1` on the RSVP link (e.g. the home's "can't attend"
   * secondary action for an unrecognised visitor). Switches the flow to a
   * short, decline-only path: find invitation, confirm identity, a single
   * respectful decline confirmation, then send.
   */
  declineIntent?: boolean
}

const INITIAL_STATE: RsvpFormState = {
  matchedHouseholds: [],
  // selectedHousehold: null,
  rsvpResponses: [],
  answersToQuestions: [],
  weddingData: {
    groomFirstName: '',
    groomLastName: '',
    brideFirstName: '',
    brideLastName: '',
    date: {
      standardFormat: '',
      numberFormat: '',
    },
    daysRemaining: 0,
    events: [],
  },
}

const RsvpFormContext = createContext(INITIAL_STATE)
const RsvpFormUpdateContext = createContext((_fields: Partial<RsvpFormState>) => {
  return
})

interface RsvpFormProviderProps {
  children?: ReactNode
  /**
   * Household resolved from the guest's save-the-date invite cookie. When
   * present, the flow pre-fills the match and starts on the confirm step.
   */
  recognizedHousehold?: HouseholdSearch[number] | null
  /** Event preselected via `?event=` on the RSVP link, so only that event's steps show. */
  preselectedEventId?: string
  /** Set via `?decline=1` on the RSVP link, switching the flow to the short decline path. */
  declineIntent?: boolean
}

export const useRsvpForm = () => {
  return useContext(RsvpFormContext)
}

export const useUpdateRsvpForm = () => {
  return useContext(RsvpFormUpdateContext)
}

export const RsvpFormProvider = ({
  children,
  recognizedHousehold,
  preselectedEventId,
  declineIntent,
}: RsvpFormProviderProps) => {
  const [rsvpFormData, setRsvpFormData] = useState<RsvpFormState>(() => ({
    ...INITIAL_STATE,
    ...(recognizedHousehold
      ? { matchedHouseholds: [recognizedHousehold], recognized: true }
      : null),
    ...(preselectedEventId ? { preselectedEventId } : null),
    ...(declineIntent ? { declineIntent } : null),
  }))

  const updateFields = (fields: Partial<RsvpFormState>) => {
    setRsvpFormData((prev) => {
      return { ...prev, ...fields }
    })
  }

  return (
    <RsvpFormContext.Provider value={rsvpFormData}>
      <RsvpFormUpdateContext.Provider value={updateFields}>
        {children}
      </RsvpFormUpdateContext.Provider>
    </RsvpFormContext.Provider>
  )
}
