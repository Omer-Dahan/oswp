import { z } from 'zod'

export const workspaceInviteSideSchema = z.enum(['כלה', 'חתן', 'אחר'])

export const createWorkspaceInviteLinkSchema = z.object({
  role: z.string().min(1).optional(),
  label: z.string().trim().max(120).nullish(),
  side: workspaceInviteSideSchema.nullish(),
  expiresInDays: z.number().int().positive().max(365).nullish(),
  maxUses: z.number().int().positive().max(1000).nullish(),
})

export const revokeWorkspaceInviteLinkSchema = z.object({
  id: z.string().min(1),
})

export const previewWorkspaceInviteLinkSchema = z.object({
  token: z.string().min(1),
})

export const acceptWorkspaceInviteLinkSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  side: workspaceInviteSideSchema,
})

export type CreateWorkspaceInviteLinkInput = z.infer<typeof createWorkspaceInviteLinkSchema>
export type RevokeWorkspaceInviteLinkInput = z.infer<typeof revokeWorkspaceInviteLinkSchema>
export type PreviewWorkspaceInviteLinkInput = z.infer<typeof previewWorkspaceInviteLinkSchema>
export type AcceptWorkspaceInviteLinkInput = z.infer<typeof acceptWorkspaceInviteLinkSchema>
