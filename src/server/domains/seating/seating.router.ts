/**
 * Seating Domain - Router
 *
 * tRPC router for the seating chart builder. Thin layer: validates input and
 * delegates to the service.
 */

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { seatingService } from '~/server/domains/seating'
import {
  applyGroupPlacementSchema,
  assignGuestsSchema,
  autoSeatSchema,
  createSeatingAreaSchema,
  createSeatingTableSchema,
  saveSeatingMapSchema,
  seatingAreaIdSchema,
  seatingEventIdSchema,
  seatingTableIdSchema,
  setActiveSeatingAreaSchema,
  suggestForGroupSchema,
  unassignGuestsSchema,
  updateSeatingAreaSchema,
  updateSeatingTableSchema,
} from '~/server/domains/seating/seating.validator'

export const seatingRouter = createTRPCRouter({
  getChart: protectedProcedure.input(seatingEventIdSchema).query(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return seatingService.getChart(ctx.authz, weddingId, input.eventId)
  }),

  createTable: protectedProcedure
    .input(createSeatingTableSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return seatingService.createTable(ctx.authz, weddingId, input)
    }),

  updateTable: protectedProcedure
    .input(updateSeatingTableSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return seatingService.updateTable(ctx.authz, weddingId, input.id, input.data)
    }),

  deleteTable: protectedProcedure.input(seatingTableIdSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return seatingService.deleteTable(ctx.authz, weddingId, input.id)
  }),

  assignGuests: protectedProcedure.input(assignGuestsSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return seatingService.assignGuests(ctx.authz, weddingId, input)
  }),

  unassignGuests: protectedProcedure
    .input(unassignGuestsSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return seatingService.unassignGuests(ctx.authz, weddingId, input)
    }),

  autoSeat: protectedProcedure.input(autoSeatSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return seatingService.autoSeat(ctx.authz, weddingId, input)
  }),

  getGroups: protectedProcedure.input(seatingEventIdSchema).query(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return seatingService.getGroups(ctx.authz, weddingId, input.eventId)
  }),

  suggestForGroup: protectedProcedure
    .input(suggestForGroupSchema)
    .query(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return seatingService.suggestForGroup(ctx.authz, weddingId, input)
    }),

  applyGroupPlacement: protectedProcedure
    .input(applyGroupPlacementSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return seatingService.applyGroupPlacement(ctx.authz, weddingId, input)
    }),

  getMap: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return seatingService.getMap(ctx.authz, weddingId)
  }),

  saveMap: protectedProcedure.input(saveSeatingMapSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return seatingService.saveMap(ctx.authz, weddingId, input)
  }),

  createArea: protectedProcedure
    .input(createSeatingAreaSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return seatingService.createArea(ctx.authz, weddingId, input)
    }),

  updateArea: protectedProcedure
    .input(updateSeatingAreaSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return seatingService.updateArea(ctx.authz, weddingId, input.id, input.data)
    }),

  deleteArea: protectedProcedure.input(seatingAreaIdSchema).mutation(async ({ ctx, input }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return seatingService.deleteArea(ctx.authz, weddingId, input.id)
  }),

  setActiveArea: protectedProcedure
    .input(setActiveSeatingAreaSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return seatingService.setActiveArea(ctx.authz, weddingId, input.areaId)
    }),
})
