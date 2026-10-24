/**
 * Event Domain - Validators
 *
 * Zod schemas for validating event-related inputs.
 */

import { z } from 'zod'

const parseDateInput = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

const isTodayOrFutureDate = (value: string | undefined): boolean => {
  if (!value) return true

  const eventDate = parseDateInput(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return eventDate >= today
}

/**
 * Schema for creating a new event
 */
export const createEventSchema = z
  .object({
    eventName: z
      .string()
      .min(1, { message: 'שם האירוע נדרש' })
      .max(50, { message: 'שם האירוע חייב להיות עד 50 תווים' }),
    date: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    venue: z.string().optional(),
    attire: z.string().optional(),
    description: z.string().optional(),
    collectRsvp: z.boolean().default(false),
    allowTagAlongs: z.boolean().default(false),
  })
  .refine((data) => isTodayOrFutureDate(data.date), {
    message: 'תאריך האירוע לא יכול להיות בעבר',
    path: ['date'],
  })

/**
 * Schema for updating an existing event
 */
export const updateEventSchema = z
  .object({
    eventId: z.string().min(1, 'Event ID is required'),
    eventName: z
      .string()
      .min(1, { message: 'שם האירוע נדרש' })
      .max(50, { message: 'שם האירוע חייב להיות עד 50 תווים' }),
    date: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    venue: z.string().optional(),
    attire: z.string().optional(),
    description: z.string().optional(),
    collectRsvp: z.boolean().optional(),
    allowTagAlongs: z.boolean().optional(),
  })
  .refine((data) => isTodayOrFutureDate(data.date), {
    message: 'תאריך האירוע לא יכול להיות בעבר',
    path: ['date'],
  })

/**
 * Schema for updating collect RSVP status
 */
export const updateCollectRsvpSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  collectRsvp: z.boolean(),
})

/**
 * Schema for deleting an event
 */
export const deleteEventSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
})

/**
 * Schema for event ID parameter
 */
export const eventIdSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
})

// Export inferred types - these are the single source of truth
export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type UpdateCollectRsvpInput = z.infer<typeof updateCollectRsvpSchema>
export type DeleteEventInput = z.infer<typeof deleteEventSchema>
