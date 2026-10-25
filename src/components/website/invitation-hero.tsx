import Image from 'next/image'
import Link from 'next/link'

/**
 * The whole hero is tuned by these two numbers: how far the floating RSVP
 * pill sits from the invitation's bottom edge (as a % of the invitation's own
 * rendered height), and the invitation's own max height within the stage.
 */
export const BOTTOM_ANCHOR_PCT = 22
export const INVITATION_MAX_HEIGHT_SVH = 92

type InvitationHeroProps = {
  /** Same RSVP link the rest of the site uses, so the household token survives. */
  rsvpHref: string
  isRsvpEnabled: boolean
  /** e.g. "דוד ומורשה", groom first; falls back to a generic label when unset. */
  coupleNames: string | null
}

/**
 * Invitation-first home: the couple's invitation and backdrop artwork fill the
 * screen on load, with a single floating RSVP pill anchored on the invitation
 * itself. Replaces the template's text-heavy home on the guest site root.
 */
export function InvitationHero({ rsvpHref, isRsvpEnabled, coupleNames }: Readonly<InvitationHeroProps>) {
  return (
    <div className='relative h-[100svh] w-full overflow-hidden'>
      <Image
        src='/brand/jerusalem-art.jpg'
        alt=''
        aria-hidden='true'
        fill
        priority
        sizes='100vw'
        className='object-cover object-center'
      />
      <div className='absolute inset-0 bg-gradient-to-b from-background/15 via-background/35 to-background/55' />

      <div className='relative flex h-full w-full items-center justify-center px-4'>
        <div
          className='relative'
          style={{
            width: `min(calc(100vw - 32px), ${INVITATION_MAX_HEIGHT_SVH}svh)`,
            height: `min(calc(100vw - 32px), ${INVITATION_MAX_HEIGHT_SVH}svh)`,
          }}
        >
          <Image
            src='/brand/invitation.jpg'
            alt={coupleNames ? `הזמנת החתונה של ${coupleNames}` : 'הזמנת החתונה'}
            fill
            priority
            sizes='(max-width: 640px) 92vw, 640px'
            className='object-contain drop-shadow-sm'
          />

          {isRsvpEnabled && (
            <div
              className='invitation-hero-enter absolute inset-x-0 mx-auto w-fit'
              style={{ bottom: `${BOTTOM_ANCHOR_PCT}%` }}
            >
              <Link
                href={rsvpHref}
                aria-label='אישור הגעה לאירוע'
                className='invitation-hero-float inline-flex h-12 items-center justify-center rounded-full bg-primary/85 px-8 font-medium text-primary-foreground shadow-sm backdrop-blur-sm transition-[box-shadow,background-color] duration-200 hover:bg-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:shadow-sm'
              >
                אישור הגעה
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
