/**
 * Household Domain - Repository
 *
 * Database operations for the Household entity.
 * This layer handles all direct database access for households.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import type {
  Household,
  HouseholdSearchResult,
  HouseholdWithGuestsAndGifts,
  PublicHouseholdSearchResult,
} from '~/server/domains/household/household.types'
import {
  normalizeImportEmail,
  normalizeImportName,
  normalizeImportPhone,
} from '~/server/domains/household/household-import-matcher'

/**
 * Shape returned to the authenticated, staff-facing household search (used by
 * coordinators manually matching a WhatsApp reply to a household). Full guest
 * contact details are appropriate here since the caller is a signed-in team
 * member of the wedding.
 */
export const rsvpHouseholdSelect = {
  id: true,
  guests: {
    include: {
      invitations: true,
      guestTagAssignments: {
        select: {
          guestTagId: true,
        },
      },
    },
  },
} satisfies Prisma.HouseholdSelect

/**
 * Shape returned to unauthenticated, guest-facing RSVP flows (public name
 * search and invite-code recognition). Deliberately omits guest contact
 * fields (email, phone) and limits invitations to events the household was
 * actually invited to, since these endpoints are reachable by anyone who
 * knows (or guesses) a guest's name.
 */
export const publicRsvpHouseholdSelect = {
  id: true,
  invitedCount: true,
  attendingCount: true,
  childrenCount: true,
  dietaryNotes: true,
  wishesMessage: true,
  guests: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      isPrimaryContact: true,
      isTagAlong: true,
      ageGroup: true,
      invitations: {
        where: {
          rsvp: {
            not: 'Not Invited',
          },
        },
        select: {
          id: true,
          eventId: true,
          rsvp: true,
        },
      },
    },
  },
} satisfies Prisma.HouseholdSelect

/**
 * Fold a name to a comparable form for the public RSVP lookup: lowercased, with
 * apostrophes/quotes dropped and hyphens/dashes treated as spaces. This makes
 * "Sarah-Jane" and "Sarah Jane" compare equal (in either direction) and lets
 * "O'Brien" match "OBrien", so a guest isn't blocked by how the couple happened
 * to punctuate their name. Also drops the Hebrew geresh (׳), gershayim (״),
 * and straight double quote ("), used the same way in Hebrew names/abbreviations.
 */
export function normalizeNameForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’"׳״]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split a search string into normalized name terms (see normalizeNameForSearch).
 */
export function tokenizeNameForSearch(value: string): string[] {
  return normalizeNameForSearch(value).split(' ').filter(Boolean)
}

export class HouseholdRepository {
  constructor(private db: PrismaClient | Prisma.TransactionClient) {}

  /**
   * Find a household by ID
   */
  async findById(id: string): Promise<Household | null> {
    return this.db.household.findUnique({
      where: { id },
    })
  }

  /**
   * Find a household by ID with guests and gifts
   */
  async findByIdWithGuestsAndGifts(id: string): Promise<HouseholdWithGuestsAndGifts | null> {
    return this.db.household.findFirst({
      where: { id },
      include: {
        guests: {
          include: {
            invitations: true,
            guestTagAssignments: {
              select: {
                guestTagId: true,
              },
            },
          },
        },
        gifts: {
          include: {
            event: {
              select: { name: true },
            },
          },
        },
      },
    })
  }

  /**
   * Find all households for a wedding
   */
  async findByWeddingId(weddingId: string): Promise<Household[]> {
    return this.db.household.findMany({
      where: { weddingId },
    })
  }

  /**
   * Find all households for a wedding with guests and gifts
   */
  async findByWeddingIdWithGuestsAndGifts(
    weddingId: string
  ): Promise<HouseholdWithGuestsAndGifts[]> {
    return this.db.household.findMany({
      where: { weddingId },
      include: {
        guests: {
          include: {
            invitations: true,
            guestTagAssignments: {
              select: {
                guestTagId: true,
              },
            },
          },
        },
        gifts: {
          include: {
            event: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * Create a new household
   */
  async create(data: {
    weddingId: string
    address1?: string | null
    address2?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    zipCode?: string | null
    likelihoodOfAttending?: number | null
    notes?: string | null
  }): Promise<Household> {
    return this.db.household.create({
      data: {
        weddingId: data.weddingId,
        address1: data.address1,
        address2: data.address2,
        city: data.city,
        state: data.state,
        country: data.country,
        zipCode: data.zipCode,
        likelihoodOfAttending: data.likelihoodOfAttending,
        notes: data.notes,
      },
    })
  }

  /**
   * Create a household with gifts
   */
  async createWithGifts(
    data: {
      weddingId: string
      address1?: string | null
      address2?: string | null
      city?: string | null
      state?: string | null
      country?: string | null
      zipCode?: string | null
      likelihoodOfAttending?: number | null
      notes?: string | null
      invitedCount?: number | null
      side?: string | null
      groupName?: string | null
      phoneAlt?: string | null
      expectedCheck?: number | null
    },
    eventIds: string[]
  ): Promise<HouseholdWithGuestsAndGifts> {
    return this.db.household.create({
      data: {
        weddingId: data.weddingId,
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
        gifts: {
          createMany: {
            data: eventIds.map((eventId) => ({
              eventId,
              thankyou: false,
            })),
          },
        },
      },
      include: {
        guests: {
          include: {
            invitations: true,
            guestTagAssignments: {
              select: {
                guestTagId: true,
              },
            },
          },
        },
        gifts: {
          include: {
            event: {
              select: { name: true },
            },
          },
        },
      },
    })
  }

  /**
   * Update an existing household
   */
  async update(
    id: string,
    data: {
      address1?: string | null
      address2?: string | null
      city?: string | null
      state?: string | null
      country?: string | null
      zipCode?: string | null
      likelihoodOfAttending?: number | null
      notes?: string | null
    }
  ): Promise<Household> {
    return this.db.household.update({
      where: { id },
      data: {
        address1: data.address1 ?? undefined,
        address2: data.address2 ?? undefined,
        city: data.city ?? undefined,
        state: data.state ?? undefined,
        country: data.country ?? undefined,
        zipCode: data.zipCode ?? undefined,
        likelihoodOfAttending: data.likelihoodOfAttending ?? undefined,
        notes: data.notes ?? undefined,
      },
    })
  }

  /**
   * Set the party-size, children count, dietary notes, and wishes message a
   * guest reported on the public RSVP flow. Nulls are written explicitly (not
   * skipped) so a returning guest can clear a previously reported value.
   */
  async updateRsvpPartyDetails(
    id: string,
    data: {
      attendingCount: number | null
      childrenCount: number | null
      dietaryNotes: string | null
      wishesMessage: string | null
    }
  ): Promise<void> {
    await this.db.household.update({
      where: { id },
      data: {
        attendingCount: data.attendingCount,
        childrenCount: data.childrenCount,
        dietaryNotes: data.dietaryNotes,
        wishesMessage: data.wishesMessage,
      },
    })
  }

  /**
   * Delete a household
   */
  async delete(id: string): Promise<Household> {
    return this.db.household.delete({
      where: { id },
    })
  }

  /**
   * Delete every household for a wedding in one statement. Cascades to
   * guests, invitations, seat assignments, tag assignments, answers, option
   * responses, gifts, and household notes.
   */
  async deleteAllForWedding(weddingId: string): Promise<number> {
    const result = await this.db.household.deleteMany({
      where: { weddingId },
    })
    return result.count
  }

  /**
   * Search households by guest name.
   *
   * The search text is split on whitespace and every term must match some
   * guest's first or last name in the household. First and last names live in
   * separate columns, so a guest typing their full name ("Betum Adobo") — as the
   * "Full Name" field prompts them to — would never match a plain `contains`
   * against either column alone. Tokenising lets "Betum", "Adobo", and
   * "Betum Adobo" all find the household. Mirrors the coordinator-side guest
   * filter (see guest-search-filter.tsx), which already matches the full name.
   *
   * Households are gated to those with at least one invited guest so the public
   * RSVP flow never surfaces people who were never invited. The gate is applied
   * at the household level (not per matched guest) to stay consistent with the
   * invite-token path, which returns the whole household regardless of any
   * single guest's status.
   */
  async search(searchText: string, weddingId: string): Promise<HouseholdSearchResult[]> {
    const terms = searchText.trim().split(/\s+/).filter(Boolean)

    // An empty/whitespace-only search must not return every household.
    if (terms.length === 0) return []

    const nameConditions: Prisma.HouseholdWhereInput[] = terms.map((term) => ({
      guests: {
        some: {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
          ],
        },
      },
    }))

    return this.db.household.findMany({
      where: {
        weddingId,
        guests: {
          some: {
            invitations: {
              some: {
                rsvp: {
                  in: ['Invited', 'Attending', 'Declined'],
                },
              },
            },
          },
        },
        AND: nameConditions,
      },
      select: rsvpHouseholdSelect,
    })
  }

  /**
   * Public, guest-facing RSVP name lookup.
   *
   * Stricter than `search`, because this runs on an unauthenticated endpoint: a
   * guest must be identified by a first AND last name (at least two terms) and
   * every term must match the SAME guest. A lone common first name like "sarah"
   * therefore no longer surfaces the whole guest list, and a query can't match
   * two different household members at once. The exception is a guest whose
   * own stored name is itself a single token (no last name on file) — a
   * single matching term is accepted there since requiring two terms would
   * make that guest permanently unfindable.
   *
   * Matching is done in memory against each guest's full name so hyphens and
   * spaces are interchangeable ("Sarah-Jane" == "Sarah Jane") while staying
   * partial- and case-tolerant. The candidate set is a single wedding's invited
   * households, so this stays small.
   */
  async searchPublicByName(
    searchText: string,
    weddingId: string
  ): Promise<PublicHouseholdSearchResult[]> {
    const terms = tokenizeNameForSearch(searchText)
    if (terms.length === 0 || terms.some((term) => term.length < 2)) return []

    const households = await this.db.household.findMany({
      where: {
        weddingId,
        guests: {
          some: {
            invitations: {
              some: {
                rsvp: {
                  in: ['Invited', 'Attending', 'Declined'],
                },
              },
            },
          },
        },
      },
      select: publicRsvpHouseholdSelect,
    })

    // Every term must appear in a single guest's full name, so the searcher has
    // actually named a specific person rather than a household member each. A
    // single search term is only accepted against a guest whose own stored
    // name is itself a single token (e.g. registered with no last name) —
    // otherwise one short term would let a common first name enumerate the
    // whole invite list.
    return households.filter((household) =>
      household.guests.some((guest) => {
        const guestNameTerms = tokenizeNameForSearch(`${guest.firstName} ${guest.lastName}`)

        if (terms.length === 1) {
          return guestNameTerms.length === 1 && guestNameTerms[0] === terms[0]
        }

        // At least one search term must fully match one of the guest's own
        // name tokens (first or last name), not just a substring, so no
        // short partial term can alone surface a match.
        const hasFullTokenMatch = terms.some((term) => guestNameTerms.includes(term))
        if (!hasFullTokenMatch) return false

        const fullName = guestNameTerms.join(' ')
        return terms.every((term) => fullName.includes(term))
      })
    )
  }

  /**
   * Check if a household exists
   */
  async exists(id: string): Promise<boolean> {
    const household = await this.db.household.findUnique({
      where: { id },
      select: { id: true },
    })
    return household !== null
  }

  /**
   * Check if a household belongs to a user
   */
  async belongsToWedding(id: string, weddingId: string): Promise<boolean> {
    const household = await this.db.household.findFirst({
      where: { id, weddingId },
      select: { id: true },
    })
    return household !== null
  }

  /**
   * Fetch the import matching keys for a wedding: the normalised phone and
   * normalised "first last" name of every household's primary contact.
   * Used both to skip duplicates during bulk import and to let the CSV
   * dialog mark rows as duplicates before the import runs.
   */
  async findImportKeys(
    weddingId: string
  ): Promise<{ phones: string[]; names: string[]; emails: string[] }> {
    const [primaryContacts, emailRows] = await Promise.all([
      this.db.guest.findMany({
        where: { weddingId, isPrimaryContact: true },
        select: { phone: true, firstName: true, lastName: true },
      }),
      this.db.guest.findMany({
        where: { weddingId, email: { not: null } },
        select: { email: true },
      }),
    ])

    const phones: string[] = []
    const names: string[] = []
    for (const contact of primaryContacts) {
      const phone = normalizeImportPhone(contact.phone)
      if (phone) phones.push(phone)
      names.push(normalizeImportName(contact.firstName, contact.lastName))
    }
    const emails: string[] = []
    for (const row of emailRows) {
      const email = normalizeImportEmail(row.email)
      if (email) emails.push(email)
    }
    return { phones, names, emails }
  }

  /**
   * Count households by IDs constrained to a wedding scope.
   */
  async countByIdsInWedding(weddingId: string, householdIds: string[]): Promise<number> {
    return this.db.household.count({
      where: {
        weddingId,
        id: { in: householdIds },
      },
    })
  }
}
