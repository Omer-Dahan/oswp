import Image from 'next/image'
import Link from 'next/link'

import type { InvitedHousehold } from '~/app/w/[websiteSubUrl]/_lib/invited-household'
import { HeroCard } from '~/components/website/hero-card'

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
  /** Set when the visitor arrived through a recognised household invite link. */
  invitedHousehold: InvitedHousehold | null
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

/** The household's primary-contact greeting, or one neutral line when nobody is recognised. */
function desktopGreetingText(invitedHousehold: InvitedHousehold | null): string {
  const contact = invitedHousehold?.primaryContactGreeting
  if (!contact) return 'נשמח לראותכם'
  const name = contact.kind === 'family' ? `משפחת ${contact.name}` : contact.name
  return `שלום ${name}, נשמח לראותכם ביום שלנו 🤍`
}

/**
 * Invitation-first home: the couple's invitation and backdrop artwork fill the
 * screen on load, with a single floating RSVP pill anchored on the invitation
 * itself. Replaces the template's text-heavy home on the guest site root.
 *
 * Mobile and desktop get different compositions (not just a resized version
 * of the same one): on narrow screens the artwork can't sit behind the card
 * without being entirely covered, so it gets its own band above the
 * invitation; on wide (md+) screens there's room for a linen backdrop with
 * both cards shown side by side, each enlargeable on hover/focus/click.
 */
export function InvitationHero({
  rsvpHref,
  isRsvpEnabled,
  coupleNames,
  invitedHousehold,
}: Readonly<InvitationHeroProps>) {
  const invitationAlt = coupleNames ? `הזמנת החתונה של ${coupleNames}` : 'הזמנת החתונה'
  const greeting = desktopGreetingText(invitedHousehold)

  return (
    <div className='relative h-[100svh] w-full overflow-hidden bg-background'>
      {/* Mobile/tablet: artwork band above the invitation, both fully visible, no overlap. */}
      <div className='flex h-full w-full flex-col md:hidden'>
        <div className='relative w-full' style={{ height: `${MOBILE_ARTWORK_BAND_SVH}svh` }}>
          <Image
            src='/brand/jerusalem-art.png'
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
              src='/brand/invitation.png'
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

      {/* Desktop: linen backdrop, two interactive cards, greeting + RSVP below them. */}
      <div className='relative hidden h-full w-full flex-col items-center justify-center gap-8 px-10 md:flex'>
        <div className='absolute inset-0'>
          <Image
            src='/brand/linen-bg.png'
            alt=''
            aria-hidden='true'
            fill
            priority
            sizes='100vw'
            className='object-cover object-center'
          />
        </div>
        {/* Soft warm veil so the white cards and copy read clearly against the linen. */}
        <div className='absolute inset-0 bg-background/35' />

        <div className='hero-cards relative z-10 flex items-stretch justify-center gap-6 lg:gap-10'>
          <div className='hero-card-enter'>
            <HeroCard src='/brand/invitation.png' label='הזמנת החתונה' expandedAlt={invitationAlt} priority />
          </div>
          <div className='hero-card-enter'>
            <HeroCard src='/brand/jerusalem-art.png' label='שמרו את התאריך' expandedAlt='שמרו את התאריך' />
          </div>
        </div>

        <div className='relative z-10 flex flex-col items-center gap-3 text-center'>
          <p className='font-serif text-foreground text-lg'>{greeting}</p>
          {isRsvpEnabled ? (
            <Link
              href={rsvpHref}
              aria-label='אישור הגעה לאירוע'
              className='inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 font-sans font-semibold text-base text-foreground leading-none tracking-normal shadow-sm ring-1 ring-black/10 transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:shadow-sm'
            >
              אישור הגעה
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
