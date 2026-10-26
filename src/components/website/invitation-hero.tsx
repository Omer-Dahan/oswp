import Image from 'next/image'
import Link from 'next/link'

import type { InvitedHousehold } from '~/app/w/[websiteSubUrl]/_lib/invited-household'
import { HeroCard, HeroCardsGroup } from '~/components/website/hero-card'

type InvitationHeroProps = {
  /** Same RSVP link the rest of the site uses, so the household token survives. */
  rsvpHref: string
  isRsvpEnabled: boolean
  /** e.g. "דוד ומורשה", groom first; falls back to a generic label when unset. */
  coupleNames: string | null
  /** Set when the visitor arrived through a recognised household invite link. */
  invitedHousehold: InvitedHousehold | null
}

function RsvpButton({
  rsvpHref,
  isRsvpEnabled,
}: Pick<InvitationHeroProps, 'rsvpHref' | 'isRsvpEnabled'>) {
  if (!isRsvpEnabled) return null
  return (
    <Link
      href={rsvpHref}
      aria-label='אישור הגעה לאירוע'
      className='inline-flex h-11 items-center justify-center rounded-full bg-primary px-8 font-sans font-semibold text-base text-foreground leading-none tracking-normal shadow-sm ring-1 ring-black/10 transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:shadow-sm sm:text-[17px]'
    >
      אישור הגעה
    </Link>
  )
}

/** The household's primary-contact greeting, or one neutral line when nobody is recognised. */
function greetingText(invitedHousehold: InvitedHousehold | null): string {
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
 * of the same one): on narrow (< md) screens the two cards stack vertically
 * over the linen backdrop, sized to stay fully on-screen with no scroll; on
 * wide (md+) screens there's room for them side by side, each enlargeable on
 * hover/focus/click.
 */
export function InvitationHero({
  rsvpHref,
  isRsvpEnabled,
  coupleNames,
  invitedHousehold,
}: Readonly<InvitationHeroProps>) {
  const invitationAlt = coupleNames ? `הזמנת החתונה של ${coupleNames}` : 'הזמנת החתונה'
  const greeting = greetingText(invitedHousehold)

  return (
    <div className='relative h-[100svh] w-full overflow-hidden bg-background'>
      {/* Mobile/tablet: linen backdrop, both cards stacked and whole, greeting + RSVP beneath. */}
      <div className='relative flex h-full w-full flex-col md:hidden'>
        <div className='absolute inset-0'>
          <Image
            src='/brand/linen-bg-portrait.png'
            alt=''
            aria-hidden='true'
            fill
            priority
            sizes='100vw'
            className='object-cover object-center'
          />
        </div>
        <div className='absolute inset-0 bg-background/35' />

        <div className='relative z-10 flex h-full w-full flex-col items-center justify-center gap-3 px-6'>
          <HeroCardsGroup className='hero-cards flex flex-col items-center gap-0'>
            <div className='hero-card-enter'>
              <HeroCard
                src='/brand/jerusalem-art.png'
                label='שמרו את התאריך'
                expandedAlt='שמרו את התאריך'
                fit='contain'
                className='aspect-square w-[min(92vw,36svh)]'
                priority
              />
            </div>
            <div className='hero-card-enter'>
              <HeroCard
                src='/brand/invitation.png'
                label='הזמנת החתונה'
                expandedAlt={invitationAlt}
                fit='contain'
                className='aspect-square w-[min(92vw,50svh)]'
              />
            </div>
          </HeroCardsGroup>

          <div className='relative z-10 flex flex-col items-center gap-0.5 text-center'>
            <p className='font-serif text-foreground text-sm'>{greeting}</p>
            <RsvpButton rsvpHref={rsvpHref} isRsvpEnabled={isRsvpEnabled} />
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

        <HeroCardsGroup className='hero-cards relative z-10 flex items-stretch justify-center gap-6 lg:gap-10'>
          <div className='hero-card-enter'>
            <HeroCard
              src='/brand/jerusalem-art.png'
              label='שמרו את התאריך'
              expandedAlt='שמרו את התאריך'
            />
          </div>
          <div className='hero-card-enter'>
            <HeroCard
              src='/brand/invitation.png'
              label='הזמנת החתונה'
              expandedAlt={invitationAlt}
              priority
            />
          </div>
        </HeroCardsGroup>

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
