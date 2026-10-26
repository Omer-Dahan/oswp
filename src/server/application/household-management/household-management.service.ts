/**
 * Household Management Application Service
 *
 * Orchestrates complex household operations that span multiple domains:
 * - Household domain (core household data)
 * - Guest domain (guest creation/updates)
 * - Invitation domain (invitation creation/updates)
 * - Gift domain (gift tracking)
 */

// biome-ignore lint/style/noRestrictedImports: Application services use PrismaClient for cross-domain transactions
import type { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import type {
  CreateHouseholdResult,
  CreateHouseholdWithGuestsInput,
  UpdateHouseholdResult,
  UpdateHouseholdWithGuestsInput,
} from '~/server/application/household-management/household-management.types'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import { GiftRepository } from '~/server/domains/gift/gift.repository'
import { GuestRepository } from '~/server/domains/guest/guest.repository'
import { HouseholdRepository } from '~/server/domains/household/household.repository'
import type {
  Household,
  HouseholdSearchResult,
  PublicHouseholdSearchResult,
} from '~/server/domains/household/household.types'
import {
  DUPLICATE_EMAIL_WARNING,
  isDuplicateHousehold,
  normalizeImportEmail,
  normalizeImportName,
  normalizeImportPhone,
} from '~/server/domains/household/household-import-matcher'
import { InvitationRepository } from '~/server/domains/invitation/invitation.repository'
import type { WebsiteRepository } from '~/server/domains/website/website.repository'
import { WebsitePasswordService } from '~/server/domains/website/website-password.service'

export class HouseholdManagementService {
  constructor(
    private householdRepo: HouseholdRepository,
    private guestRepo: GuestRepository,
    private invitationRepo: InvitationRepository,
    _giftRepo: GiftRepository,
    private websiteRepo: WebsiteRepository,
    private db: PrismaClient,
    private websitePasswordService: WebsitePasswordService = new WebsitePasswordService()
  ) {}

  async createHouseholdWithGuests(
    ctx: AuthzContext,
    weddingId: string,
    data: CreateHouseholdWithGuestsInput
  ): Promise<CreateHouseholdResult> {
    requirePermission(ctx, { guest: ['create'] })
    await this.assertEventIdsInWeddingScope(
      data.guestParty.flatMap((guest) => Object.keys(guest.invites)),
      weddingId
    )

    return this.db.$transaction(async (tx) => {
      const txHouseholdRepo = new HouseholdRepository(tx)
      const txGuestRepo = new GuestRepository(tx)

      let defaultEventIds: string[] | undefined
      const getDefaultEventIds = async () => {
        defaultEventIds ??= (
          await tx.event.findMany({
            where: { weddingId },
            select: { id: true },
          })
        ).map((event) => event.id)
        return defaultEventIds
      }

      const eventIds = Object.keys(data.guestParty[0]?.invites ?? {})

      const household = await txHouseholdRepo.createWithGifts(
        {
          weddingId,
          address1: data.address1,
          address2: data.address2,
          city: data.city,
          state: data.state,
          country: data.country,
          zipCode: data.zipCode,
          likelihoodOfAttending: data.likelihoodOfAttending,
          notes: data.notes,
          invitedCount: data.invitedCount,
          side: data.side,
          groupName: data.groupName,
          phoneAlt: data.phoneAlt,
          expectedCheck: data.expectedCheck,
        },
        eventIds
      )

      if (!household) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create household',
        })
      }

      // Guests are created sequentially (not via Promise.all) because they all
      // run queries against the same interactive transaction client: the
      // @prisma/adapter-pg driver adapter serializes everything onto one
      // pooled connection, and firing concurrent queries at it can hang the
      // transaction indefinitely instead of erroring.
      const guests = []
      for (const [index, guest] of data.guestParty.entries()) {
        const isTagAlong = guest.isTagAlong ?? false
        const inviteEntries = Object.entries(guest.invites)
        const defaultInviteEntries =
          inviteEntries.length === 0
            ? (await getDefaultEventIds()).map((eventId) => [eventId, 'Not Invited'] as const)
            : inviteEntries
        const invitations = defaultInviteEntries.map(([eventId, rsvp]) => ({
          eventId,
          rsvp,
          weddingId,
        }))

        const createdGuest = await txGuestRepo.create({
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email ?? null,
          phone: guest.phone ?? null,
          weddingId,
          householdId: household.id,
          isPrimaryContact: isTagAlong ? false : (guest.isPrimaryContact ?? index === 0),
          ageGroup: guest.ageGroup ?? null,
          isTagAlong,
          invitations,
          tagIds: guest.tagIds ?? [],
        })

        const guestWithTags = await txGuestRepo.findByIdWithInvitations(createdGuest.id)

        if (!guestWithTags) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to refetch guest after creation',
          })
        }

        guests.push(guestWithTags)
      }

      if (!guests.length) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create guests',
        })
      }

      return {
        household,
        guests,
      }
    })
  }

  async updateHouseholdWithGuests(
    ctx: AuthzContext,
    weddingId: string,
    data: UpdateHouseholdWithGuestsInput
  ): Promise<UpdateHouseholdResult> {
    requirePermission(ctx, { guest: ['update'] })
    await this.assertHouseholdInWeddingScope(data.householdId, weddingId)
    await this.assertGuestIdsInWeddingScope(
      data.guestParty.flatMap((guest) => (guest.guestId ? [guest.guestId] : [])),
      weddingId
    )
    await this.assertGuestIdsInWeddingScope(data.deletedGuests ?? [], weddingId)
    await this.assertEventIdsInWeddingScope(
      [
        ...data.guestParty.flatMap((guest) => Object.keys(guest.invites)),
        ...data.gifts.map((gift) => gift.eventId),
      ],
      weddingId
    )

    return this.db.$transaction(async (tx) => {
      const txHouseholdRepo = new HouseholdRepository(tx)
      const txGuestRepo = new GuestRepository(tx)
      const txInvitationRepo = new InvitationRepository(tx)
      const txGiftRepo = new GiftRepository(tx)
      let defaultEventIds: string[] | undefined
      const getDefaultEventIds = async () => {
        defaultEventIds ??= (
          await tx.event.findMany({
            where: { weddingId },
            select: { id: true },
          })
        ).map((event) => event.id)
        return defaultEventIds
      }

      const updatedHousehold = await txHouseholdRepo.update(data.householdId, {
        address1: data.address1 ?? undefined,
        address2: data.address2 ?? undefined,
        city: data.city ?? undefined,
        state: data.state ?? undefined,
        country: data.country ?? undefined,
        zipCode: data.zipCode ?? undefined,
        likelihoodOfAttending: data.likelihoodOfAttending ?? undefined,
        notes: data.notes ?? undefined,
      })

      if (data.deletedGuests && data.deletedGuests.length > 0) {
        await txGuestRepo.deleteMany(data.deletedGuests)
      }

      await txGuestRepo.clearPrimaryContactsByHousehold(data.householdId)

      const updatedGuests: NonNullable<
        Awaited<ReturnType<typeof txGuestRepo.findByIdWithInvitations>>
      >[] = []
      for (const guest of data.guestParty) {
        const isTagAlong = guest.isTagAlong ?? false
        const inviteEntries = Object.entries(guest.invites)
        const defaultInviteEntries =
          !guest.guestId && inviteEntries.length === 0
            ? (await getDefaultEventIds()).map((eventId) => [eventId, 'Not Invited'] as const)
            : inviteEntries
        const invitations = defaultInviteEntries.map(([eventId, rsvp]) => ({
          eventId,
          rsvp,
          weddingId,
        }))

        const updatedGuest = await txGuestRepo.upsert(
          guest.guestId,
          {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email ?? null,
            phone: guest.phone ?? null,
            householdId: data.householdId,
            weddingId,
            isPrimaryContact: isTagAlong ? false : (guest.isPrimaryContact ?? false),
            ageGroup: guest.ageGroup ?? null,
            isTagAlong,
          },
          invitations
        )

        if (isTagAlong && guest.guestId) {
          const allowedEventIds = Object.keys(guest.invites)
          if (allowedEventIds.length > 0) {
            await txInvitationRepo.deleteByGuestExcludingEvents(guest.guestId, allowedEventIds)
          } else {
            await txInvitationRepo.deleteByGuest(guest.guestId)
          }
        }

        if (guest.tagIds !== undefined) {
          await txGuestRepo.updateTags(updatedGuest.id, guest.tagIds)
        }

        if (guest.guestId) {
          for (const [inviteEventId, inputRsvp] of Object.entries(guest.invites)) {
            await txInvitationRepo.update(guest.guestId ?? updatedGuest.id, inviteEventId, {
              rsvp: inputRsvp,
            })
          }
        }

        const guestWithTags = await txGuestRepo.findByIdWithInvitations(updatedGuest.id)

        if (!guestWithTags) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to refetch guest after update',
          })
        }

        updatedGuests.push(guestWithTags)
      }

      if (!updatedHousehold || !updatedGuests) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update guests',
        })
      }

      const updatedGifts = []
      for (const gift of data.gifts) {
        updatedGifts.push(
          await txGiftRepo.upsert({
            householdId: data.householdId,
            eventId: gift.eventId,
            description: gift.description,
            thankyou: gift.thankyou ?? false,
          })
        )
      }

      return {
        household: updatedHousehold,
        guests: updatedGuests,
        gifts: updatedGifts,
      }
    })
  }

  async deleteHousehold(
    ctx: AuthzContext,
    householdId: string,
    weddingId: string
  ): Promise<string> {
    requirePermission(ctx, { guest: ['delete'] })
    await this.assertHouseholdInWeddingScope(householdId, weddingId)

    const deletedHousehold = await this.householdRepo.delete(householdId)
    return deletedHousehold.id
  }

  async deleteAllHouseholds(ctx: AuthzContext, weddingId: string): Promise<{ deleted: number }> {
    requirePermission(ctx, { guest: ['delete_all'] })
    const deleted = await this.householdRepo.deleteAllForWedding(weddingId)
    return { deleted }
  }

  async bulkCreateHouseholds(
    ctx: AuthzContext,
    weddingId: string,
    households: Parameters<HouseholdManagementService['createHouseholdWithGuests']>[2][]
  ): Promise<{
    created: number
    skipped: number
    failed: number
    warnings: string[]
    failureReasons: string[]
  }> {
    requirePermission(ctx, { guest: ['import'] })

    const existingKeys = await this.householdRepo.findImportKeys(weddingId)
    const phones = new Set(existingKeys.phones)
    const names = new Set(existingKeys.names)
    const usedEmails = new Set(existingKeys.emails)

    let created = 0
    let skipped = 0
    let failed = 0
    const warnings: string[] = []
    const failureReasons: string[] = []
    for (const household of households) {
      const primaryContact =
        household.guestParty.find((guest) => guest.isPrimaryContact) ?? household.guestParty[0]

      if (primaryContact && isDuplicateHousehold(primaryContact, { phones, names })) {
        skipped++
        continue
      }

      // Duplicate emails must never fail the row: the email is dropped and a
      // warning is recorded, but the guest (and its household) is still created.
      const guestParty = household.guestParty.map((guest) => {
        const normalizedEmail = normalizeImportEmail(guest.email)
        if (!normalizedEmail) return guest
        if (usedEmails.has(normalizedEmail)) {
          warnings.push(DUPLICATE_EMAIL_WARNING)
          return { ...guest, email: null }
        }
        usedEmails.add(normalizedEmail)
        return { ...guest, email: normalizedEmail }
      })

      try {
        await this.createHouseholdWithGuests(ctx, weddingId, { ...household, guestParty })
        created++
        if (primaryContact) {
          const phone = normalizeImportPhone(primaryContact.phone)
          if (phone) phones.add(phone)
          names.add(normalizeImportName(primaryContact.firstName, primaryContact.lastName))
        }
      } catch (error) {
        if (error instanceof TRPCError && ['FORBIDDEN', 'UNAUTHORIZED'].includes(error.code)) {
          throw error
        }
        failed++
        failureReasons.push(error instanceof Error ? error.message : 'שגיאה לא ידועה בייבוא השורה')
      }
    }
    return { created, skipped, failed, warnings, failureReasons }
  }

  async getHouseholdImportKeys(
    ctx: AuthzContext,
    weddingId: string
  ): Promise<{ phones: string[]; names: string[]; emails: string[] }> {
    requirePermission(ctx, { guest: ['import'] })
    return this.householdRepo.findImportKeys(weddingId)
  }

  async searchHouseholds(
    ctx: AuthzContext,
    weddingId: string,
    searchText: string
  ): Promise<HouseholdSearchResult[]> {
    requirePermission(ctx, { guest: ['read'] })
    return this.householdRepo.search(searchText, weddingId)
  }

  /**
   * Search households for the public guest-facing RSVP flow.
   *
   * The guest is unauthenticated, so the search is scoped to the wedding that
   * owns the given website subUrl rather than to an active wedding session.
   * When the website is password-protected, this endpoint is itself a way to
   * read (a restricted slice of) the guest list, so it must honour the
   * password gate rather than only relying on the page that normally sits in
   * front of it.
   */
  async searchHouseholdsPublic(
    subUrl: string,
    searchText: string,
    accessToken?: string
  ): Promise<PublicHouseholdSearchResult[]> {
    const website = await this.websiteRepo.findBySubUrl(subUrl)

    if (!website?.isRsvpEnabled) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RSVP is not available for this wedding',
      })
    }

    if (website.isPasswordEnabled) {
      const hasPasswordAccess = this.websitePasswordService.verifyAccessToken(
        accessToken,
        website.id,
        website.password
      )
      if (!hasPasswordAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Password access required for this wedding website',
        })
      }
    }

    return this.householdRepo.searchPublicByName(searchText, website.weddingId)
  }

  /**
   * Update only the mailing address fields of a household
   */
  async updateHouseholdAddress(
    ctx: AuthzContext,
    weddingId: string,
    householdId: string,
    data: {
      address1?: string | null
      address2?: string | null
      city?: string | null
      state?: string | null
      country?: string | null
      zipCode?: string | null
    }
  ): Promise<Household> {
    requirePermission(ctx, { guest: ['update'] })
    await this.assertHouseholdInWeddingScope(householdId, weddingId)
    return this.householdRepo.update(householdId, data)
  }

  private async assertHouseholdInWeddingScope(
    householdId: string,
    weddingId: string
  ): Promise<void> {
    const belongsToWedding = await this.householdRepo.belongsToWedding(householdId, weddingId)

    if (!belongsToWedding) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify this household',
      })
    }
  }

  private async assertGuestIdsInWeddingScope(guestIds: number[], weddingId: string): Promise<void> {
    const uniqueGuestIds = [...new Set(guestIds)]
    for (const guestId of uniqueGuestIds) {
      const belongsToWedding = await this.guestRepo.belongsToWedding(guestId, weddingId)
      if (!belongsToWedding) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Guest ${guestId} is outside the requested wedding scope`,
        })
      }
    }
  }

  private async assertEventIdsInWeddingScope(eventIds: string[], weddingId: string): Promise<void> {
    const uniqueEventIds = [...new Set(eventIds)]
    for (const eventId of uniqueEventIds) {
      const belongsToWedding = await this.invitationRepo.eventBelongsToWedding(eventId, weddingId)
      if (!belongsToWedding) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Event ${eventId} is outside the requested wedding scope`,
        })
      }
    }
  }
}
