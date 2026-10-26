/**
 * Household Domain - Router
 *
 * tRPC router for household-related endpoints.
 * This is a thin layer that handles input validation and delegates to the application service.
 *
 * NOTE: This router now delegates to HouseholdManagementService (Application layer)
 * to eliminate redundancy between HouseholdService and HouseholdManagementService.
 */

import { TRPCError } from '@trpc/server'

import { createTRPCRouter, protectedProcedure, publicProcedure } from '~/server/api/trpc'
import { householdManagementService } from '~/server/application/household-management'
import { getClientIp } from '~/server/application/rsvp-submission'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { eventService } from '~/server/domains/event'
import {
  bulkCreateHouseholdsSchema,
  createHouseholdSchema,
  deleteHouseholdSchema,
  publicHouseholdDetailsSchema,
  publicSearchHouseholdSchema,
  searchHouseholdSchema,
  updateHouseholdSchema,
} from '~/server/domains/household/household.validator'

export const householdRouter = createTRPCRouter({
  /**
   * Create a new household with guests
   */
  create: protectedProcedure.input(createHouseholdSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return householdManagementService.createHouseholdWithGuests(ctx.authz, weddingId, input)
  }),

  /**
   * Update a household with guests
   */
  update: protectedProcedure.input(updateHouseholdSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return householdManagementService.updateHouseholdWithGuests(ctx.authz, weddingId, input)
  }),

  /**
   * Bulk create households from CSV import
   */
  bulkCreate: protectedProcedure
    .input(bulkCreateHouseholdsSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)

      // Validate that all invites event IDs belong to this wedding
      const validEvents = await eventService.getWeddingEvents(weddingId)
      const validEventIds = new Set((validEvents ?? []).map((e) => e.id))
      for (const household of input.households) {
        for (const guest of household.guestParty) {
          for (const eventId of Object.keys(guest.invites)) {
            if (!validEventIds.has(eventId)) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Event ${eventId} does not belong to your wedding`,
              })
            }
          }
        }
      }

      return householdManagementService.bulkCreateHouseholds(ctx.authz, weddingId, input.households)
    }),

  /**
   * Import matching keys (existing primary-contact phones and names) for the
   * active wedding, used by the CSV import dialog to mark duplicate rows
   * before import.
   */
  importKeys: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return householdManagementService.getHouseholdImportKeys(ctx.authz, weddingId)
  }),

  /**
   * Delete a household
   */
  delete: protectedProcedure.input(deleteHouseholdSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return householdManagementService.deleteHousehold(ctx.authz, input.householdId, weddingId)
  }),

  /**
   * Delete every household (and all cascading guest data) for the current wedding
   */
  deleteAll: protectedProcedure.mutation(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return householdManagementService.deleteAllHouseholds(ctx.authz, weddingId)
  }),

  /**
   * Search households by guest name (authenticated coordinator flow)
   */
  findBySearch: protectedProcedure.input(searchHouseholdSchema).query(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return householdManagementService.searchHouseholds(ctx.authz, weddingId, input.searchText)
  }),

  /**
   * Search households by guest name from the public guest-facing RSVP flow.
   *
   * Guests are not authenticated, so the search is scoped to the wedding that
   * owns the website subUrl instead of an active wedding session.
   */
  findBySearchPublic: publicProcedure
    .input(publicSearchHouseholdSchema)
    .query(async ({ ctx, input }) => {
      return householdManagementService.searchHouseholdsPublic(
        input.subUrl,
        input.searchText,
        getClientIp(ctx.headers),
        input.accessToken
      )
    }),

  /**
   * Fetch a single household's private fields (dietary notes, wishes
   * message) from the public guest-facing RSVP flow, gated on `searchText`
   * matching that household — see household-management.service.ts.
   */
  getPublicHouseholdDetails: publicProcedure
    .input(publicHouseholdDetailsSchema)
    .query(async ({ ctx, input }) => {
      return householdManagementService.getPublicHouseholdDetails(
        input.subUrl,
        input.householdId,
        input.searchText,
        getClientIp(ctx.headers),
        input.accessToken
      )
    }),
})
