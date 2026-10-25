import Image from 'next/image'
import Link from 'next/link'

/**
 * The whole hero is tuned by these numbers: how far the floating RSVP pill
 * straddles the invitation's bottom edge (in px — nudge to taste), the
 * invitation's own max size within its stage, and the mobile artwork band's
 * share of the viewport (the rest of the viewport height goes to the
 * invitation zone below it).
 */
export const PILL_OVERLAP_PX = 22
export const MOBILE_ARTWORK_BAND_SVH = 38
export const MOBILE_INVITATION_MAX_SVH = 52
export const DESKTOP_INVITATION_MAX_SVH = 72
export const DESKTOP_INVITATION_MAX_PX = 640

type InvitationHeroProps = {
  /** Same RSVP link the rest of the site uses, so the household token survives. */
  rsvpHref: string
  isRsvpEnabled: boolean
  /** e.g. "דוד ומורשה", groom first; falls back to a generic label when unset. */
  coupleNames: string | null
}

function RsvpPill({ rsvpHref, isRsvpEnabled }: Pick<InvitationHeroProps, 'rsvpHref' | 'isRsvpEnabled'>) {
  if (!isRsvpEnabled) return null
  return (
    <div className='invitation-hero-enter absolute inset-x-0 mx-auto w-fit' style={{ bottom: `-${PILL_OVERLAP_PX}px` }}>
      <Link
        href={rsvpHref}
        aria-label='אישור הגעה לאירוע'
        className='inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 font-sans font-semibold text-base text-foreground leading-none tracking-normal shadow-sm ring-1 ring-black/10 transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:shadow-sm sm:text-[17px]'
      >
        אישור הגעה
      </Link>
    </div>
  )
}

/**
 * Invitation-first home: the couple's invitation and backdrop artwork fill the
 * screen on load, with a single floating RSVP pill anchored on the invitation
 * itself. Replaces the template's text-heavy home on the guest site root.
 *
 * Mobile and desktop get different compositions (not just a resized version
 * of the same one): on narrow screens the artwork can't sit behind the card
 * without being entirely covered, so it gets its own band above the
 * invitation; on wide screens there's room for it as a full-bleed backdrop.
 */
export function InvitationHero({ rsvpHref, isRsvpEnabled, coupleNames }: Readonly<InvitationHeroProps>) {
  const invitationAlt = coupleNames ? `הזמנת החתונה של ${coupleNames}` : 'הזמנת החתונה'

  return (
    <div className='relative h-[100svh] w-full overflow-hidden bg-background'>
      {/* Mobile: artwork band above the invitation, both fully visible, no overlap. */}
      <div className='flex h-full w-full flex-col sm:hidden'>
        <div className='relative w-full' style={{ height: `${MOBILE_ARTWORK_BAND_SVH}svh` }}>
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
        <div className='relative flex flex-1 items-center justify-center px-4'>
          <div
            className='relative'
            style={{
              width: `min(92vw, ${MOBILE_INVITATION_MAX_SVH}svh)`,
              height: `min(92vw, ${MOBILE_INVITATION_MAX_SVH}svh)`,
            }}
          >
            <Image
              src='/brand/invitation.jpg'
              alt={invitationAlt}
              fill
              priority
              sizes='92vw'
              quality={90}
              className='object-contain drop-shadow-sm'
            />
            <RsvpPill rsvpHref={rsvpHref} isRsvpEnabled={isRsvpEnabled} />
          </div>
        </div>
      </div>

      {/* Desktop: artwork as a full-bleed backdrop, invitation sized down so both read. */}
      <div className='relative hidden h-full w-full items-center justify-center sm:flex'>
        <div className='absolute inset-0'>
          <Image
            src='/brand/jerusalem-art.jpg'
            alt=''
            aria-hidden='true'
            fill
            priority
            sizes='100vw'
            className='object-cover object-center'
          />
        </div>
        <div className='absolute inset-0 bg-gradient-to-b from-background/15 via-background/35 to-background/55' />

        <div
          className='relative'
          style={{
            width: `min(${DESKTOP_INVITATION_MAX_SVH}svh, ${DESKTOP_INVITATION_MAX_PX}px)`,
            height: `min(${DESKTOP_INVITATION_MAX_SVH}svh, ${DESKTOP_INVITATION_MAX_PX}px)`,
          }}
        >
          <Image
            src='/brand/invitation.jpg'
            alt={invitationAlt}
            fill
            priority
            sizes={`min(${DESKTOP_INVITATION_MAX_SVH}svh, ${DESKTOP_INVITATION_MAX_PX}px)`}
            quality={90}
            className='object-contain drop-shadow-sm'
          />
          <RsvpPill rsvpHref={rsvpHref} isRsvpEnabled={isRsvpEnabled} />
        </div>
      </div>
    </div>
  )
}
