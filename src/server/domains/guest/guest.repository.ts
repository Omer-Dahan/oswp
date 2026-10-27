/**
 * Guest Domain - Repository
 *
 * Database operations for the Guest entity.
 * This layer handles all direct database access for guests.
 */

import type { GuestAgeGroup, Prisma, PrismaClient } from '@prisma/client'

import type { Guest, GuestWithInvitations } from '~/server/domains/guest/guest.types'

export class GuestRepository {
  constructor(private db: PrismaClient | Prisma.TransactionClient) {}

  /**
   * Find a guest by ID
   */
  async findById(id: number): Promise<Guest | null> {
    return this.db.guest.findUnique({
      where: { id },
    })
  }

  /**
   * Find a guest by ID with invitations
   */
  async findByIdWithInvitations(id: number): Promise<GuestWithInvitations | null> {
    return this.db.guest.findUnique({
      where: { id },
      include: {
        invitations: true,
        guestTagAssignments: {
          select: {
            guestTagId: true,
          },
        },
      },
    })
  }

  /**
   * Find all guests for a wedding
   */
  async findByWeddingId(weddingId: string): Promise<Guest[]> {
    return this.db.guest.findMany({
      where: { weddingId },
    })
  }

  /**
   * Find all guests for a household
   */
  async findByHouseholdId(householdId: string): Promise<Guest[]> {
    return this.db.guest.findMany({
      where: { householdId },
    })
  }

  /**
   * Find all guests for a household with invitations
   */
  async findByHouseholdIdWithInvitations(householdId: string): Promise<GuestWithInvitations[]> {
    return this.db.guest.findMany({
      where: { householdId },
      include: {
        invitations: true,
      },
    })
  }

  /**
   * Create a new guest with optional invitations and tags
   */
  async create(data: {
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    householdId: string
    weddingId: string
    isPrimaryContact?: boolean
    ageGroup?: GuestAgeGroup | null
    isTagAlong?: boolean
    invitations?: Array<{
      eventId: string
      rsvp: string
      weddingId: string
    }>
    tagIds?: string[]
  }): Promise<Guest> {
    return this.db.guest.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        householdId: data.householdId,
        weddingId: data.weddingId,
        isPrimaryContact: data.isPrimaryContact ?? false,
        ageGroup: data.ageGroup ?? null,
        isTagAlong: data.isTagAlong ?? false,
        invitations: data.invitations
          ? {
              createMany: {
                data: data.invitations,
              },
            }
          : undefined,
        guestTagAssignments: data.tagIds
          ? {
              createMany: {
                data: data.tagIds.map((tagId) => ({ guestTagId: tagId })),
              },
            }
          : undefined,
      },
    })
  }

  /**
   * Update an existing guest
   */
  async update(
    id: number,
    data: {
      firstName?: string
      lastName?: string
      email?: string | null
      phone?: string | null
      ageGroup?: GuestAgeGroup | null
      isPrimaryContact?: boolean
      isTagAlong?: boolean
    }
  ): Promise<Guest> {
    return this.db.guest.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        ageGroup: data.ageGroup,
        isPrimaryContact: data.isPrimaryContact,
        isTagAlong: data.isTagAlong,
      },
    })
  }

  /**
   * Upsert a guest with optional invitations and tags
   * Note: Tags are only created in the CREATE branch. For updates, use updateTags() separately.
   */
  async upsert(
    id: number | undefined,
    data: {
      firstName: string
      lastName: string
      email?: string | null
      phone?: string | null
      householdId: string
      weddingId: string
      isPrimaryContact?: boolean
      ageGroup?: GuestAgeGroup | null
      isTagAlong?: boolean
    },
    invitations?: Array<{
      eventId: string
      rsvp: string
      weddingId: string
    }>,
    tagIds?: string[]
  ): Promise<Guest> {
    return this.db.guest.upsert({
      where: { id: id ?? -1 },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        isPrimaryContact: data.isPrimaryContact,
        ageGroup: data.ageGroup,
        isTagAlong: data.isTagAlong,
      },
      create: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        householdId: data.householdId,
        weddingId: data.weddingId,
        isPrimaryContact: data.isPrimaryContact ?? false,
        ageGroup: data.ageGroup ?? null,
        isTagAlong: data.isTagAlong ?? false,
        invitations: invitations
          ? {
              createMany: {
                data: invitations,
              },
            }
          : undefined,
        guestTagAssignments: tagIds
          ? {
              createMany: {
                data: tagIds.map((tagId) => ({ guestTagId: tagId })),
              },
            }
          : undefined,
      },
    })
  }

  /**
   * Update guest tags
   * Replaces all existing tags with the provided list
   */
  async updateTags(guestId: number, tagIds: string[]): Promise<void> {
    // Delete existing tag assignments
    await this.db.guestTagAssignment.deleteMany({
      where: { guestId },
    })

    // Create new tag assignments if provided
    if (tagIds.length > 0) {
      await this.db.guestTagAssignment.createMany({
        data: tagIds.map((tagId) => ({
          guestId,
          guestTagId: tagId,
        })),
      })
    }
  }

  /**
   * Delete a guest
   */
  async delete(id: number): Promise<Guest> {
    return this.db.guest.delete({
      where: { id },
    })
  }

  /**
   * Delete multiple guests
   */
  async deleteMany(ids: number[]): Promise<{ count: number }> {
    return this.db.guest.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    })
  }

  /**
   * Clear primary contact flag for all guests in a household
   */
  async clearPrimaryContactsByHousehold(householdId: string): Promise<{ count: number }> {
    return this.db.guest.updateMany({
      where: { householdId },
      data: { isPrimaryContact: false },
    })
  }

  /**
   * Check if a guest exists
   */
  async exists(id: number): Promise<boolean> {
    const guest = await this.db.guest.findUnique({
      where: { id },
      select: { id: true },
    })
    return guest !== null
  }

  /**
   * Check if a guest belongs to a wedding
   */
  async belongsToWedding(id: number, weddingId: string): Promise<boolean> {
    const guest = await this.db.guest.findFirst({
      where: { id, weddingId },
      select: { id: true },
    })
    return guest !== null
  }

  /**
   * Find a guest by email and wedding ID (used for duplicate self-fill registration checks)
   */
  async findByEmailAndWeddingId(email: string, weddingId: string): Promise<Guest | null> {
    return this.db.guest.findFirst({
      where: { email, weddingId },
    })
  }

  /**
   * Count guests by wedding ID
   */
  async countByWeddingId(
    weddingId: string,
    options?: { excludeTagAlongs?: boolean }
  ): Promise<number> {
    return this.db.guest.count({
      where: {
        weddingId,
        ...(options?.excludeTagAlongs ? { isTagAlong: false } : {}),
      },
    })
  }

  /**
   * Count tag-along guests by wedding ID
   */
  async countTagAlongsByWeddingId(weddingId: string): Promise<number> {
    return this.db.guest.count({
      where: { weddingId, isTagAlong: true },
    })
  }

  /**
   * Count guests by IDs constrained to a wedding scope
   */
  async countByIdsInWedding(weddingId: string, guestIds: number[]): Promise<number> {
    return this.db.guest.count({
      where: {
        weddingId,
        id: { in: guestIds },
      },
    })
  }

  /**
   * Count guests by IDs constrained to a single household. Used to verify a
   * public RSVP submission's guestIds all belong to the household it claims
   * to come from.
   */
  async countByIdsInHousehold(householdId: string, guestIds: number[]): Promise<number> {
    return this.db.guest.count({
      where: {
        householdId,
        id: { in: guestIds },
      },
    })
  }

  /**
   * Replace a household's named "extra" guests (tag-alongs added on the
   * who-is-coming RSVP step) with a fresh set. Re-submitting the RSVP form
   * must not accumulate duplicate tag-along rows across submissions, so the
   * previous set is deleted first — cascading away their invitations and any
   * seat assignment, which is correct since the replacement guest rows get
   * new IDs. Each new tag-along gets an 'Attending' invitation for every
   * event the household is attending, so they surface in seating and the
   * kitchen report alongside the named guests.
   */
  /**
   * Reconcile a household's tag-along guests against the submitted name list,
   * rather than deleting and recreating them all. A tag-along is only removed
   * when its name is explicitly absent from `names` — this keeps manually
   * added tag-alongs (and their seating/tags/answers, which cascade off the
   * guest row) alive across resubmissions that don't touch this list.
   *
   * Invitation rows for kept tag-alongs are synced both ways: `attendingEventIds`
   * are upserted to 'Attending' and `declinedEventIds` are flipped to 'Declined',
   * so a tag-along can't stay 'Attending' an event the household just declined.
   * A brand-new tag-along is only created when there's at least one attending
   * event — otherwise it would end up with zero invitation rows and be invisible
   * to seating/kitchen counts, so we skip creating it entirely rather than leave
   * it in that state.
   */
  async replaceTagAlongs(
    householdId: string,
    weddingId: string,
    names: string[],
    attendingEventIds: string[],
    declinedEventIds: string[] = []
  ): Promise<void> {
    const existingTagAlongs = await this.db.guest.findMany({
      where: { householdId, isTagAlong: true },
      select: { id: true, firstName: true, lastName: true },
    })

    const toFullName = (firstName: string, lastName: string) =>
      [firstName, lastName].filter(Boolean).join(' ')

    const submittedNames = new Set(names.map((name) => name.trim()))
    const matchedExistingIds = new Set<number>()

    for (const existing of existingTagAlongs) {
      if (submittedNames.has(toFullName(existing.firstName, existing.lastName))) {
        matchedExistingIds.add(existing.id)
      }
    }

    const toRemove = existingTagAlongs.filter((existing) => !matchedExistingIds.has(existing.id))
    if (toRemove.length > 0) {
      await this.db.guest.deleteMany({
        where: { id: { in: toRemove.map((guest) => guest.id) } },
      })
    }

    const existingNames = new Set(
      existingTagAlongs
        .filter((existing) => matchedExistingIds.has(existing.id))
        .map((existing) => toFullName(existing.firstName, existing.lastName))
    )

    if (matchedExistingIds.size > 0 && attendingEventIds.length > 0) {
      // Flip any existing row (e.g. 'Declined' from a prior submission) back
      // to 'Attending', then fill in rows that never existed yet.
      await this.db.invitation.updateMany({
        where: {
          guestId: { in: Array.from(matchedExistingIds) },
          eventId: { in: attendingEventIds },
        },
        data: { rsvp: 'Attending' },
      })
      await this.db.invitation.createMany({
        data: Array.from(matchedExistingIds).flatMap((guestId) =>
          attendingEventIds.map((eventId) => ({
            guestId,
            eventId,
            weddingId,
            rsvp: 'Attending',
          }))
        ),
        skipDuplicates: true,
      })
    }

    if (matchedExistingIds.size > 0 && declinedEventIds.length > 0) {
      // Only updates rows that already exist — there's nothing to flip to
      // 'Declined' for an event this tag-along was never invited to.
      await this.db.invitation.updateMany({
        where: {
          guestId: { in: Array.from(matchedExistingIds) },
          eventId: { in: declinedEventIds },
        },
        data: { rsvp: 'Declined' },
      })
    }

    if (attendingEventIds.length > 0) {
      for (const name of names) {
        const trimmedName = name.trim()
        if (existingNames.has(trimmedName)) continue

        const [firstName, ...rest] = trimmedName.split(/\s+/)
        await this.db.guest.create({
          data: {
            firstName: firstName ?? trimmedName,
            lastName: rest.join(' '),
            householdId,
            weddingId,
            isTagAlong: true,
            invitations: {
              createMany: {
                data: attendingEventIds.map((eventId) => ({
                  eventId,
                  weddingId,
                  rsvp: 'Attending',
                })),
              },
            },
          },
        })
      }
    }
  }
}
