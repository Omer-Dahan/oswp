export type WorkspaceInviteInvalidReason = 'not_found' | 'revoked' | 'expired' | 'used_up'

export type WorkspaceInviteLinkSummary = {
  id: string
  token: string
  role: string
  label: string | null
  side: string | null
  maxUses: number | null
  usedCount: number
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export type WorkspaceInvitePreviewResult =
  | { valid: true; coupleNames: string; side: string | null }
  | { valid: false; reason: WorkspaceInviteInvalidReason }

export type WorkspaceMemberSummary = {
  id: string
  role: string
  side: string | null
  createdAt: Date
  user: {
    name: string | null
    email: string | null
    image: string | null
  }
}

export type WorkspaceInviteAcceptResult =
  | { ok: true }
  | { ok: false; error: WorkspaceInviteInvalidReason | 'email_exists' | 'invalid_role' }
