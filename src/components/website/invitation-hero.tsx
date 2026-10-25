import Image from 'next/image'
import Link from 'next/link'

/**
 * The whole hero is tuned by these two numbers: how far the floating RSVP
 * pill straddles the invitation's bottom edge (in px — nudge to taste), and
 * the invitation's own max height within the stage.
 */
export const PILL_OVERLAP_PX = 22
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
      <div className='absolute inset-0 bg-background'>
        <Image
          src='/brand/jerusalem-art.jpg'
          alt=''
          aria-hidden='true'
          fill
          priority
          sizes='100vw'
          className='object-contain object-center'
        />
      </div>
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
            sizes='(max-width: 640px) 92vw, min(92svh, 1000px)'
            quality={90}
            className='object-contain drop-shadow-sm'
          />

          {isRsvpEnabled && (
            <div
              className='invitation-hero-enter absolute inset-x-0 mx-auto w-fit'
              style={{ bottom: `-${PILL_OVERLAP_PX}px` }}
            >
              <Link
                href={rsvpHref}
                aria-label='אישור הגעה לאירוע'
                className='invitation-hero-float inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 font-sans font-semibold text-base text-foreground leading-none tracking-normal shadow-sm ring-1 ring-black/10 transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:shadow-sm sm:text-[17px]'
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
