import { randomBytes } from 'node:crypto'

/**
 * 18 random bytes base64url-encoded yields 24 characters, with no risk of
 * collision in practice. Used as the opaque, unguessable invite link token.
 */
export const createWorkspaceInviteToken = (): string => randomBytes(18).toString('base64url')
