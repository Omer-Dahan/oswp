import { Button } from '~/components/ui/button'
import type { RsvpEventRef } from '~/lib/wedding/rsvp-events'

type HouseholdRsvpActionsProps = {
  websiteSubUrl: string
  weddingEvent: RsvpEventRef | null
  chuppahEvent: RsvpEventRef | null
  /** Set from `?rsvp=` after the one-click POST redirects back here. */
  rsvpOutcome?: string
  labelFontClassName?: string
}

/**
 * Three one-click RSVP actions for a household recognised on its save-the-date
 * page: an "Attending" pill per event it holds (wedding, and chuppah when the
 * wedding has one) plus a quiet "can't make it" action. Each posts straight to
 * the one-click RSVP route — no multi-step form, since the household is
 * already resolved from its invite cookie.
 */
export function HouseholdRsvpActions({
  websiteSubUrl,
  weddingEvent,
  chuppahEvent,
  rsvpOutcome,
  labelFontClassName = '',
}: Readonly<HouseholdRsvpActionsProps>) {
  const rsvpActionPath = `/w/${websiteSubUrl}/save-the-date/rsvp`

  return (
    <div className='mt-4 flex flex-col items-center gap-3 sm:items-start'>
      {rsvpOutcome ? (
        <p className='text-primary text-sm' role='status'>
          {rsvpOutcome === 'declined'
            ? 'תיעדנו שלא תוכלו להגיע, תודה שעדכנתם אותנו.'
            : 'תודה, אישור ההגעה שלכם נקלט.'}
        </p>
      ) : null}
      <div className='flex flex-wrap items-center justify-center gap-3 sm:justify-start'>
        {weddingEvent ? (
          <form action={rsvpActionPath} method='POST'>
            <input type='hidden' name='intent' value='attend' />
            <input type='hidden' name='eventId' value={weddingEvent.id} />
            <Button type='submit' size='lg'>
              אישור הגעה לחתונה
            </Button>
          </form>
        ) : null}
        {chuppahEvent ? (
          <form action={rsvpActionPath} method='POST'>
            <input type='hidden' name='intent' value='attend' />
            <input type='hidden' name='eventId' value={chuppahEvent.id} />
            <Button type='submit' size='lg'>
              אישור הגעה לחופה
            </Button>
          </form>
        ) : null}
      </div>
      <form action={rsvpActionPath} method='POST'>
        <input type='hidden' name='intent' value='decline' />
        <button
          type='submit'
          className={`text-muted-foreground text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${labelFontClassName}`}
        >
          לצערי לא נוכל להגיע
        </button>
      </form>
    </div>
  )
}
