/**
 * Guest Self-Add Application Service
 *
 * Lets a guest who's missing from the couple's list add themselves from the
 * wedding's public RSVP page, without any coordinator involvement. Mirrors
 * the invite flow a coordinator would otherwise run by hand: a new household
 * is created with a mintable invite code, and the guest is marked attending
 * for the wedding and chuppah events.
 */

// biome-ignore lint/style/noRestrictedImports: Application service owns a cross-domain public flow.
import type { Prisma, PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'

import { SELF_ADD_GROUP_NAME, SELF_ADD_NOTE_PREFIX } from '~/lib/constants/guest-self-add'
import { normalizePhoneToE164 } from '~/lib/phone/phone-validator'
import { resolveRsvpEvents } from '~/lib/wedding/rsvp-events'
import type { GuestSelfAddSchemaInput } from '~/server/application/guest-self-add/guest-self-add.validator'
import { PrismaRateLimiter } from '~/server/infrastructure/rate-limit'

export type GuestSelfAddResult = { kind: 'received' }

const ISRAELI_MOBILE_E164_PATTERN = /^\+9725\d{8}$/

function formatDateDdMmYyyy(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

/** First token is the first name, everything after it is the last name. */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/)
  return { firstName: firstName ?? fullName, lastName: rest.join(' ') }
}

export class GuestSelfAddService {
  private ipRateLimiter: PrismaRateLimiter
  private phoneRateLimiter: PrismaRateLimiter

  constructor(private db: PrismaClient) {
    // Generous enough for a guest retyping a typo'd phone/name a few times,
    // tight enough to stop a scripted sweep of this unauthenticated endpoint.
    this.ipRateLimiter = new PrismaRateLimiter(db, { limit: 5, windowMs: 15 * 60_000 })
    this.phoneRateLimiter = new PrismaRateLimiter(db, { limit: 5, windowMs: 15 * 60_000 })
  }

  async addSelf(input: GuestSelfAddSchemaInput, clientIp: string): Promise<GuestSelfAddResult> {
    const ipAllowed = await this.ipRateLimiter.check(`guest-self-add:ip:${clientIp}`)
    if (!ipAllowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
      })
    }

    // The schema already normalises `phone` to E.164, but it's re-derived
    // here defensively so the rate-limit key and the stored value can never
    // diverge from each other.
    const normalizedPhone = normalizePhoneToE164(input.phone, 'IL') ?? input.phone
    const isValidMobile = ISRAELI_MOBILE_E164_PATTERN.test(normalizedPhone)

    const phoneAllowed = await this.phoneRateLimiter.check(
      `guest-self-add:phone:${normalizedPhone}`
    )
    if (!phoneAllowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
      })
    }

    const website = await this.db.website.findFirst({
      where: { subUrl: input.subUrl },
      select: { weddingId: true, isRsvpEnabled: true },
    })

    if (!website?.isRsvpEnabled) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'אישור הגעה אינו זמין לחתונה זו',
      })
    }

    const weddingId = website.weddingId

    await this.db.$transaction(async (tx) => {
      // Serialises concurrent submissions of the same phone number within
      // this transaction so the duplicate check below can't race with
      // another submission's insert — there's no DB-level unique constraint
      // on `phone` to fall back on, since a guest's phone is optional and
      // reused across tag-alongs.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${weddingId}:${normalizedPhone}`})::bigint)`

      const existingGuest = await this.findExistingGuestByPhone(tx, weddingId, normalizedPhone)
      if (existingGuest || !isValidMobile) return

      const { firstName, lastName } = splitFullName(input.fullName)
      const notes = `${SELF_ADD_NOTE_PREFIX} ${formatDateDdMmYyyy(new Date())}`

      const household = await tx.household.create({
        data: {
          weddingId,
          side: null,
          groupName: SELF_ADD_GROUP_NAME,
          attendingCount: input.attendingCount,
          invitedCount: input.attendingCount,
          notes,
        },
      })

      const guest = await tx.guest.create({
        data: {
          weddingId,
          householdId: household.id,
          firstName,
          lastName,
          phone: normalizedPhone,
          isPrimaryContact: true,
          ageGroup: 'ADULT',
        },
      })

      const events = await tx.event.findMany({
        where: { weddingId },
        select: { id: true, name: true, isPrimary: true, collectRsvp: true },
      })
      const { weddingEvent, chuppahEvent } = resolveRsvpEvents(events)
      const attendingEventIds = [weddingEvent, chuppahEvent]
        .filter((event): event is { id: string; name: string } => event !== null)
        .map((event) => event.id)

      if (attendingEventIds.length > 0) {
        const submittedAt = new Date()
        await tx.invitation.createMany({
          data: attendingEventIds.map((eventId) => ({
            weddingId,
            guestId: guest.id,
            eventId,
            rsvp: 'Attending',
            submittedBy: guest.id,
            submittedAt,
          })),
        })
      }
    })

    return { kind: 'received' }
  }

  /**
   * Looks for a guest already registered with this phone number in the
   * wedding. Stored phone numbers predate E.164 normalisation in places (CSV
   * imports, manual entry), so every candidate is re-normalised before
   * comparing rather than relying on an exact string match against the raw
   * column.
   */
  private async findExistingGuestByPhone(
    tx: Prisma.TransactionClient,
    weddingId: string,
    normalizedPhone: string
  ): Promise<{ householdId: string } | null> {
    const candidates = await tx.guest.findMany({
      where: { weddingId, phone: { not: null } },
      select: { phone: true, householdId: true },
    })

    for (const candidate of candidates) {
      if (normalizePhoneToE164(candidate.phone, 'IL') === normalizedPhone) {
        return { householdId: candidate.householdId }
      }
    }

    return null
  }
}
