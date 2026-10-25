/**
 * Workspace Invite Domain - Barrel Export
 */

export { WorkspaceInviteService } from '~/server/domains/workspace-invite/workspace-invite.service'
export { workspaceInviteService } from '~/server/domains/workspace-invite/workspace-invite.service.instance'
export { workspaceInviteRouter } from '~/server/domains/workspace-invite/workspace-invite.router'
export type {
  WorkspaceInviteAcceptResult,
  WorkspaceInviteInvalidReason,
  WorkspaceInviteLinkSummary,
  WorkspaceInvitePreviewResult,
} from '~/server/domains/workspace-invite/workspace-invite.types'
export {
  acceptWorkspaceInviteLinkSchema,
  createWorkspaceInviteLinkSchema,
  previewWorkspaceInviteLinkSchema,
  revokeWorkspaceInviteLinkSchema,
  workspaceInviteSideSchema,
} from '~/server/domains/workspace-invite/workspace-invite.validator'
