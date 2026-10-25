/**
 * @jest-environment node
 */

jest.mock('~/server/authz/permission-checker', () => ({
  requirePermission: jest.fn(() => ({ organizationId: 'org-1', role: 'owner' })),
}))

import { TRPCError } from '@trpc/server'

import type { AuthzContext } from '~/server/authz/authorization.types'
import { WorkspaceInviteService } from '~/server/domains/workspace-invite/workspace-invite.service'

const ctx: AuthzContext = { userId: 'user-1', activeOrganization: { organizationId: 'org-1', role: 'owner' } }

const weddingRow = {
  groomFirstName: 'דני',
  groomLastName: 'כהן',
  brideFirstName: 'שירה',
  brideLastName: 'לוי',
}

const makeDb = () => {
  const workspaceInviteLink = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  }
  const member = { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) }
  const wedding = { findUnique: jest.fn().mockResolvedValue(weddingRow) }
  const user = { findUnique: jest.fn().mockResolvedValue(null) }

  const tx = { workspaceInviteLink, member, wedding, user }

  const db = {
    workspaceInviteLink,
    wedding,
    user,
    $transaction: jest.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
  }

  return { db, member, wedding, user }
}

const makeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'link-1',
  weddingId: 'wedding-1',
  token: 'tok-1',
  role: 'family',
  label: null,
  side: null,
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
  revokedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('WorkspaceInviteService', () => {
  describe('create + preview', () => {
    it('previews a freshly created token as valid', async () => {
      const { db } = makeDb()
      const signUpEmail = jest.fn()
      const provisionWeddingWorkspace = jest.fn()
      const service = new WorkspaceInviteService(db as never, signUpEmail, provisionWeddingWorkspace)

      db.workspaceInviteLink.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        ...makeRow(),
        ...args.data,
      }))

      const { token } = await service.create(ctx, 'wedding-1', {})
      expect(token).toBeTruthy()

      db.workspaceInviteLink.findUnique.mockResolvedValue(makeRow({ token }))

      const preview = await service.preview(token)
      expect(preview).toEqual({ valid: true, coupleNames: 'שירה לוי & דני כהן', side: null })
    })

    it('refuses role "owner"', async () => {
      const { db } = makeDb()
      const service = new WorkspaceInviteService(db as never, jest.fn(), jest.fn())

      await expect(service.create(ctx, 'wedding-1', { role: 'owner' })).rejects.toThrow(TRPCError)
      expect(db.workspaceInviteLink.create).not.toHaveBeenCalled()
    })

    it('refuses a role outside organizationRoles', async () => {
      const { db } = makeDb()
      const service = new WorkspaceInviteService(db as never, jest.fn(), jest.fn())

      await expect(service.create(ctx, 'wedding-1', { role: 'bogus' })).rejects.toThrow(TRPCError)
      expect(db.workspaceInviteLink.create).not.toHaveBeenCalled()
    })
  })

  describe('preview invalidity reasons', () => {
    it.each([
      ['expired', makeRow({ expiresAt: new Date(Date.now() - 1000) })],
      ['revoked', makeRow({ revokedAt: new Date() })],
      ['used_up', makeRow({ maxUses: 2, usedCount: 2 })],
    ])('returns %s', async (reason, row) => {
      const { db } = makeDb()
      const service = new WorkspaceInviteService(db as never, jest.fn(), jest.fn())
      db.workspaceInviteLink.findUnique.mockResolvedValue(row)

      const preview = await service.preview('tok-1')
      expect(preview).toEqual({ valid: false, reason })
    })

    it('returns not_found for an unknown token', async () => {
      const { db } = makeDb()
      const service = new WorkspaceInviteService(db as never, jest.fn(), jest.fn())
      db.workspaceInviteLink.findUnique.mockResolvedValue(null)

      const preview = await service.preview('missing')
      expect(preview).toEqual({ valid: false, reason: 'not_found' })
    })
  })

  describe('accept', () => {
    const acceptInput = {
      token: 'tok-1',
      fullName: 'Test User',
      email: 'new@example.com',
      password: 'password123',
      side: 'אחר' as const,
    }

    it('rejects with email_exists and does not increment usedCount', async () => {
      const { db, user, member } = makeDb()
      db.workspaceInviteLink.findUnique.mockResolvedValue(makeRow())
      user.findUnique.mockResolvedValue({ id: 'existing-user' })
      const service = new WorkspaceInviteService(db as never, jest.fn(), jest.fn())

      const result = await service.accept(acceptInput)

      expect(result).toEqual({ ok: false, error: 'email_exists' })
      expect(db.workspaceInviteLink.update).not.toHaveBeenCalled()
      expect(member.create).not.toHaveBeenCalled()
    })

    it.each([
      ['revoked', makeRow({ revokedAt: new Date() })],
      ['used_up', makeRow({ maxUses: 1, usedCount: 1 })],
    ])('rejects against a %s token and creates no member', async (reason, row) => {
      const { db, member } = makeDb()
      db.workspaceInviteLink.findUnique.mockResolvedValue(row)
      const service = new WorkspaceInviteService(db as never, jest.fn(), jest.fn())

      const result = await service.accept(acceptInput)

      expect(result).toEqual({ ok: false, error: reason })
      expect(member.create).not.toHaveBeenCalled()
    })

    it('creates a member and increments usedCount on success', async () => {
      const { db, member } = makeDb()
      db.workspaceInviteLink.findUnique.mockResolvedValue(makeRow())
      const signUpEmail = jest.fn().mockResolvedValue({ user: { id: 'new-user' } })
      const provisionWeddingWorkspace = jest.fn().mockResolvedValue({ organizationId: 'org-1' })
      const service = new WorkspaceInviteService(db as never, signUpEmail, provisionWeddingWorkspace)

      const result = await service.accept(acceptInput)

      expect(result).toEqual({ ok: true })
      expect(member.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'family', side: 'אחר' }) })
      )
      expect(db.workspaceInviteLink.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { usedCount: { increment: 1 } },
      })
    })

    it('links to an existing organization directly without provisioning, creating exactly one member row', async () => {
      const { db, member, wedding } = makeDb()
      wedding.findUnique.mockResolvedValue({ ...weddingRow, organizationId: 'org-existing' })
      db.workspaceInviteLink.findUnique.mockResolvedValue(makeRow({ role: 'family' }))
      const signUpEmail = jest.fn().mockResolvedValue({ user: { id: 'new-user' } })
      const provisionWeddingWorkspace = jest.fn()
      const service = new WorkspaceInviteService(db as never, signUpEmail, provisionWeddingWorkspace)

      const result = await service.accept(acceptInput)

      expect(result).toEqual({ ok: true })
      expect(provisionWeddingWorkspace).not.toHaveBeenCalled()
      expect(member.create).toHaveBeenCalledTimes(1)
      expect(member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-existing', role: 'family' }),
        })
      )
    })

    it('does not create a second member row when one already exists for the organization', async () => {
      const { db, member, wedding } = makeDb()
      wedding.findUnique.mockResolvedValue({ ...weddingRow, organizationId: 'org-existing' })
      member.findFirst.mockResolvedValue({ id: 'member-existing' })
      db.workspaceInviteLink.findUnique.mockResolvedValue(makeRow())
      const signUpEmail = jest.fn().mockResolvedValue({ user: { id: 'new-user' } })
      const provisionWeddingWorkspace = jest.fn()
      const service = new WorkspaceInviteService(db as never, signUpEmail, provisionWeddingWorkspace)

      const result = await service.accept(acceptInput)

      expect(result).toEqual({ ok: true })
      expect(member.create).not.toHaveBeenCalled()
    })
  })
})
