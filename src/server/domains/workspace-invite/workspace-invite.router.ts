/**
 * Workspace Invite Domain - Router
 *
 * Shareable token-link invites that grant access to a wedding's workspace
 * without going through Better Auth's email-based organization invitation.
 */

import { createTRPCRouter, protectedProcedure, publicProcedure } from '~/server/api/trpc'
import { requireActiveWeddingId } from '~/server/authz/active-wedding'
import { workspaceInviteService } from '~/server/domains/workspace-invite/workspace-invite.service.instance'
import {
  acceptWorkspaceInviteLinkSchema,
  createWorkspaceInviteLinkSchema,
  previewWorkspaceInviteLinkSchema,
  revokeWorkspaceInviteLinkSchema,
} from '~/server/domains/workspace-invite/workspace-invite.validator'

export const workspaceInviteRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createWorkspaceInviteLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return workspaceInviteService.create(ctx.authz, weddingId, input)
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return workspaceInviteService.list(ctx.authz, weddingId)
  }),

  listMembers: protectedProcedure.query(async ({ ctx }) => {
    const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
    return workspaceInviteService.listMembers(weddingId)
  }),

  revoke: protectedProcedure
    .input(revokeWorkspaceInviteLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const weddingId = requireActiveWeddingId(ctx.auth.activeWeddingId)
      return workspaceInviteService.revoke(ctx.authz, weddingId, input.id)
    }),

  preview: publicProcedure.input(previewWorkspaceInviteLinkSchema).query(async ({ input }) => {
    return workspaceInviteService.preview(input.token)
  }),

  accept: publicProcedure.input(acceptWorkspaceInviteLinkSchema).mutation(async ({ input }) => {
    return workspaceInviteService.accept(input)
  }),
})
