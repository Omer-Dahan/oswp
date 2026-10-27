export const RSVP_STEP_KEYS = ['children-count', 'dietary-notes', 'wishes-message'] as const
export type RsvpStepKey = (typeof RSVP_STEP_KEYS)[number]

export const DEFAULT_RSVP_STEPS: readonly RsvpStepKey[] = ['children-count', 'dietary-notes']

const RSVP_STEP_KEY_SET = new Set<string>(RSVP_STEP_KEYS)

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
