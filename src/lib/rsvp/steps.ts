export const RSVP_STEP_KEYS = ['children-count', 'dietary-notes', 'wishes-message'] as const
export type RsvpStepKey = (typeof RSVP_STEP_KEYS)[number]

export const DEFAULT_RSVP_STEPS: readonly RsvpStepKey[] = ['children-count', 'dietary-notes']

const RSVP_STEP_KEY_SET = new Set<string>(RSVP_STEP_KEYS)

type RsvpStepEvent = {
  id: string
  collectRsvp?: boolean
  rsvpSteps?: readonly string[]
}

export function normalizeRsvpSteps(steps: readonly string[] | undefined): RsvpStepKey[] {
  const configuredSteps = steps ?? DEFAULT_RSVP_STEPS
  const seen = new Set<RsvpStepKey>()
  const normalized: RsvpStepKey[] = []

  for (const step of configuredSteps) {
    if (!RSVP_STEP_KEY_SET.has(step)) continue
    const key = step as RsvpStepKey
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(key)
  }

  return normalized
}

export function getScopedRsvpSteps({
  weddingSteps,
  events,
  preselectedEventId,
  invitedEventIds,
}: {
  weddingSteps: readonly string[] | undefined
  events: readonly RsvpStepEvent[]
  preselectedEventId?: string
  invitedEventIds: ReadonlySet<string>
}): RsvpStepKey[] {
  const scopedEventSteps = new Set<string>()

  for (const event of events) {
    if (event.collectRsvp === false) continue
    const isInScope = preselectedEventId
      ? event.id === preselectedEventId
      : invitedEventIds.has(event.id)
    if (!isInScope) continue

    for (const step of event.rsvpSteps ?? []) {
      if (RSVP_STEP_KEY_SET.has(step)) scopedEventSteps.add(step)
    }
  }

  return normalizeRsvpSteps(weddingSteps).filter((step) => scopedEventSteps.has(step))
}
