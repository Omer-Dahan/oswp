import Image from 'next/image'
import Link from 'next/link'

import type { InvitedHousehold } from '~/app/w/[websiteSubUrl]/_lib/invited-household'
import { CopyHouseholdInviteLinkButton } from '~/components/website/copy-household-invite-link-button'
import { HeroCard, HeroCardsGroup } from '~/components/website/hero-card'
import { SaveTheDateAction } from '~/components/website/save-the-date-reveal'
import { resolveRsvpEvents } from '~/lib/wedding/rsvp-events'

type InvitationHeroProps = {
  websiteSubUrl: string
  /** Same RSVP link the rest of the site uses, so the household token survives. */
  rsvpHref: string
  isRsvpEnabled: boolean
  /** e.g. "דוד ומורשה", groom first; falls back to a generic label when unset. */
  coupleNames: string | null
  /** Set when the visitor arrived through a recognised household invite link. */
  invitedHousehold: InvitedHousehold | null
  /** The wedding's events, used to resolve the per-event RSVP pills. */
  events: Array<{ id: string; name: string; isPrimary: boolean }>
  /** The household's own save-the-date invite code, when recognised. */
  householdInviteCode: string | null
}

type RsvpPillSize = 'mobile' | 'desktop'

const RSVP_PILL_CLASSES: Record<RsvpPillSize, string> = {
  mobile:
    'inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 font-sans font-semibold text-foreground text-sm leading-none tracking-normal shadow-sm ring-1 ring-black/10 transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:scale-[0.97]',
  desktop:
    'inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 font-sans font-semibold text-base text-foreground leading-none tracking-normal shadow-sm ring-1 ring-black/10 transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:scale-[0.97]',
}

const SECONDARY_LINK_CLASSES =
  'font-sans text-foreground/70 text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97]'

/** The two per-event RSVP pills, side by side (stacked below 375px). */
function RsvpPills({
  rsvpHref,
  isRsvpEnabled,
  weddingEvent,
  chuppahEvent,
  size,
}: {
  rsvpHref: string
  isRsvpEnabled: boolean
  weddingEvent: { id: string } | null
  chuppahEvent: { id: string } | null
  size: RsvpPillSize
}) {
  if (!isRsvpEnabled || !weddingEvent) return null
  return (
    <div className='flex flex-col items-center gap-2 min-[376px]:flex-row'>
      <Link
        href={`${rsvpHref}?event=${weddingEvent.id}`}
        aria-label='אישור הגעה לחתונה'
        className={RSVP_PILL_CLASSES[size]}
      >
        אישור הגעה לחתונה
      </Link>
      {chuppahEvent ? (
        <Link
          href={`${rsvpHref}?event=${chuppahEvent.id}`}
          aria-label='אישור הגעה לחופה'
          className={RSVP_PILL_CLASSES[size]}
        >
          אישור הגעה לחופה
        </Link>
      ) : null}
    </div>
  )
}

/** Quiet secondary actions beneath the primary RSVP pills. */
function SecondaryActions({
  websiteSubUrl,
  householdInviteCode,
  invitationAlt,
}: {
  websiteSubUrl: string
  householdInviteCode: string | null
  invitationAlt: string
}) {
  return (
    <div className='flex items-center gap-4'>
      <SaveTheDateAction invitationAlt={invitationAlt} className={SECONDARY_LINK_CLASSES} />
      {householdInviteCode ? (
        <CopyHouseholdInviteLinkButton
          websiteSubUrl={websiteSubUrl}
          inviteCode={householdInviteCode}
        />
      ) : null}
    </div>
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
  websiteSubUrl,
  rsvpHref,
  isRsvpEnabled,
  coupleNames,
  invitedHousehold,
  events,
  householdInviteCode,
}: Readonly<InvitationHeroProps>) {
  const invitationAlt = coupleNames ? `הזמנת החתונה של ${coupleNames}` : 'הזמנת החתונה'
  const greeting = greetingText(invitedHousehold)
  const { weddingEvent, chuppahEvent } = resolveRsvpEvents(events)

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
            <div>
              <HeroCard
                src='/brand/jerusalem-art.png'
                label='שמרו את התאריך'
                expandedAlt='שמרו את התאריך'
                fit='contain'
                className='aspect-square w-[min(92vw,36svh)]'
                mobile
                priority
              />
            </div>
            <div>
              <HeroCard
                src='/brand/invitation.png'
                label='הזמנת החתונה'
                expandedAlt={invitationAlt}
                fit='contain'
                className='aspect-square w-[min(92vw,36svh)]'
                mobile
              />
            </div>
          </HeroCardsGroup>

          <div className='relative z-10 flex flex-col items-center gap-2 text-center'>
            <p className='font-serif text-foreground text-sm'>{greeting}</p>
            <RsvpPills
              rsvpHref={rsvpHref}
              isRsvpEnabled={isRsvpEnabled}
              weddingEvent={weddingEvent}
              chuppahEvent={chuppahEvent}
              size='mobile'
            />
            <SecondaryActions
              websiteSubUrl={websiteSubUrl}
              householdInviteCode={invitedHousehold ? householdInviteCode : null}
              invitationAlt={invitationAlt}
            />
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
          <RsvpPills
            rsvpHref={rsvpHref}
            isRsvpEnabled={isRsvpEnabled}
            weddingEvent={weddingEvent}
            chuppahEvent={chuppahEvent}
            size='desktop'
          />
          <SecondaryActions
            websiteSubUrl={websiteSubUrl}
            householdInviteCode={invitedHousehold ? householdInviteCode : null}
            invitationAlt={invitationAlt}
          />
        </div>
      </div>
    </div>
  )
}
