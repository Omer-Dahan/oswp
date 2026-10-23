/**
 * RSVP Status Constants
 *
 * Defines the possible RSVP statuses used throughout the application.
 */

export const RSVP_STATUS = {
  NOT_INVITED: 'Not Invited',
  INVITED: 'Invited',
  ATTENDING: 'Attending',
  DECLINED: 'Declined',
} as const

export type RsvpStatus = (typeof RSVP_STATUS)[keyof typeof RSVP_STATUS]

/**
 * Array of all RSVP statuses for iteration/validation
 */
export const RSVP_STATUS_VALUES = Object.values(RSVP_STATUS)

/**
 * Hebrew display labels for RSVP statuses, keyed by the underlying stored value.
 */
export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  [RSVP_STATUS.NOT_INVITED]: 'לא הוזמן',
  [RSVP_STATUS.INVITED]: 'הוזמן',
  [RSVP_STATUS.ATTENDING]: 'מגיע/ה',
  [RSVP_STATUS.DECLINED]: 'לא מגיע/ה',
}
