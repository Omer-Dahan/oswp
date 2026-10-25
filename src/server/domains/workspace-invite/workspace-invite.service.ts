import { randomUUID } from 'node:crypto'

import type { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'

import { organizationRoles } from '~/lib/auth-permissions'
import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import { createWorkspaceInviteToken } from '~/server/domains/workspace-invite/workspace-invite-token'
import type {
  WorkspaceInviteAcceptResult,
  WorkspaceInviteInvalidReason,
  WorkspaceInviteLinkSummary,
  WorkspaceInvitePreviewResult,
  WorkspaceMemberSummary,
} from '~/server/domains/workspace-invite/workspace-invite.types'
import type {
  AcceptWorkspaceInviteLinkInput,
  CreateWorkspaceInviteLinkInput,
} from '~/server/domains/workspace-invite/workspace-invite.validator'

// Hand-written delegate types for the `workspace_invite_links` table and the
// new `member.side` column: the Prisma client is only regenerated once,
// centrally, after every schema-touching change in this batch lands, so these
// mirror the schema by hand instead of depending on `@prisma/client`'s
// generated (and currently stale) `PrismaClient` type.
type WorkspaceInviteLinkRow = {
  id: string
  weddingId: string
  token: string
  role: string
  label: string | null
  side: string | null
  maxUses: number | null
  usedCount: number
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type WorkspaceInviteLinkDelegate = {
  create: (args: {
    data: Pick<
      WorkspaceInviteLinkRow,
      'id' | 'weddingId' | 'token' | 'role' | 'label' | 'side' | 'maxUses' | 'expiresAt'
    >
  }) => Promise<WorkspaceInviteLinkRow>
  findUnique: (args: {
    where: { token: string } | { id: string }
  }) => Promise<WorkspaceInviteLinkRow | null>
  findMany: (args: {
    where: { weddingId: string }
    orderBy: { createdAt: 'desc' }
  }) => Promise<WorkspaceInviteLinkRow[]>
  updateMany: (args: {
    where: { id: string; weddingId: string; revokedAt: null }
    data: { revokedAt: Date }
  }) => Promise<{ count: number }>
  update: (args: {
    where: { id: string }
    data: { usedCount: { increment: number } }
  }) => Promise<WorkspaceInviteLinkRow>
}

type MemberRow = {
  id: string
  role: string
  side: string | null
  createdAt: Date
  user: { name: string | null; email: string | null; image: string | null }
}

type MemberDelegate = {
  create: (args: {
    data: { id: string; organizationId: string; userId: string; role: string; side: string | null }
  }) => Promise<unknown>
  findFirst: (args: {
    where: { organizationId: string; userId: string }
  }) => Promise<{ id: string } | null>
  findMany: (args: {
    where: { organizationId: string }
    orderBy: { createdAt: 'asc' }
    include: { user: { select: { name: true; email: true; image: true } } }
  }) => Promise<MemberRow[]>
}

type WorkspaceInviteTx = Pick<PrismaClient, 'wedding' | 'user'> & {
  workspaceInviteLink: WorkspaceInviteLinkDelegate
  member: MemberDelegate
}

type WorkspaceInviteDb = Pick<PrismaClient, 'wedding' | 'user'> & {
  workspaceInviteLink: WorkspaceInviteLinkDelegate
  member: MemberDelegate
  $transaction: <T>(fn: (tx: WorkspaceInviteTx) => Promise<T>) => Promise<T>
}

export type SignUpEmailFn = (args: {
  body: { email: string; password: string; name: string }
}) => Promise<{ user: { id: string } }>

export type ProvisionWeddingWorkspaceFn = (args: {
  weddingId: string
  name: string
  userId: string
}) => Promise<{ organizationId: string }>

export type CreateWorkspaceInviteLinkResult = { token: string; path: string }

const checkValidity = (
  link: WorkspaceInviteLinkRow | null
): { valid: true } | { valid: false; reason: WorkspaceInviteInvalidReason } => {
  if (!link) return { valid: false, reason: 'not_found' }
  if (link.revokedAt) return { valid: false, reason: 'revoked' }
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    return { valid: false, reason: 'expired' }
  }
  if (link.maxUses !== null && link.usedCount >= link.maxUses) {
    return { valid: false, reason: 'used_up' }
  }
  return { valid: true }
}

class WorkspaceInviteValidationError extends Error {
  constructor(public reason: WorkspaceInviteInvalidReason) {
    super(reason)
  }
}

export class WorkspaceInviteService {
  constructor(
    private db: WorkspaceInviteDb,
    private signUpEmail: SignUpEmailFn,
    private provisionWeddingWorkspace: ProvisionWeddingWorkspaceFn
  ) {}

  async create(
    ctx: AuthzContext,
    weddingId: string,
    input: CreateWorkspaceInviteLinkInput
  ): Promise<CreateWorkspaceInviteLinkResult> {
    requirePermission(ctx, { member: ['create'] })

    const role = input.role ?? 'family'
    if (role === 'owner' || !(role in organizationRoles)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'תפקיד לא חוקי לקישור הזמנה' })
    }

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const link = await this.db.workspaceInviteLink.create({
      data: {
        id: randomUUID(),
        weddingId,
        token: createWorkspaceInviteToken(),
        role,
        label: input.label ?? null,
        side: input.side ?? null,
        maxUses: input.maxUses ?? null,
        expiresAt,
      },
    })

    return { token: link.token, path: `/team/${link.token}` }
  }

  async list(ctx: AuthzContext, weddingId: string): Promise<WorkspaceInviteLinkSummary[]> {
    requirePermission(ctx, { member: ['create'] })

    const links = await this.db.workspaceInviteLink.findMany({
      where: { weddingId },
      orderBy: { createdAt: 'desc' },
    })

    return links.map((link) => ({
      id: link.id,
      token: link.token,
      role: link.role,
      label: link.label,
      side: link.side,
      maxUses: link.maxUses,
      usedCount: link.usedCount,
      expiresAt: link.expiresAt,
      revokedAt: link.revokedAt,
      createdAt: link.createdAt,
    }))
  }

  async listMembers(weddingId: string): Promise<WorkspaceMemberSummary[]> {
    const wedding = await this.db.wedding.findUnique({
      where: { id: weddingId },
      select: { organizationId: true },
    })

    if (!wedding?.organizationId) return []

    const members = await this.db.member.findMany({
      where: { organizationId: wedding.organizationId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true, email: true, image: true } } },
    })

    return members.map((member) => ({
      id: member.id,
      role: member.role,
      side: member.side,
      createdAt: member.createdAt,
      user: member.user,
    }))
  }

  async revoke(ctx: AuthzContext, weddingId: string, id: string): Promise<{ ok: true }> {
    requirePermission(ctx, { member: ['update'] })

    await this.db.workspaceInviteLink.updateMany({
      where: { id, weddingId, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    return { ok: true }
  }

  async preview(token: string): Promise<WorkspaceInvitePreviewResult> {
    const link = await this.db.workspaceInviteLink.findUnique({ where: { token } })
    const validity = checkValidity(link)
    if (!validity.valid) return { valid: false, reason: validity.reason }

    const row = link as WorkspaceInviteLinkRow
    const wedding = await this.db.wedding.findUnique({
      where: { id: row.weddingId },
      select: { groomFirstName: true, groomLastName: true, brideFirstName: true, brideLastName: true },
    })

    if (!wedding) return { valid: false, reason: 'not_found' }

    return {
      valid: true,
      coupleNames: `${wedding.brideFirstName} ${wedding.brideLastName} & ${wedding.groomFirstName} ${wedding.groomLastName}`,
      side: row.side,
    }
  }

  async accept(input: AcceptWorkspaceInviteLinkInput): Promise<WorkspaceInviteAcceptResult> {
    const link = await this.db.workspaceInviteLink.findUnique({ where: { token: input.token } })
    const validity = checkValidity(link)
    if (!validity.valid) return { ok: false, error: validity.reason }

    const row = link as WorkspaceInviteLinkRow

    const existingUser = await this.db.user.findUnique({ where: { email: input.email } })
    if (existingUser) return { ok: false, error: 'email_exists' }

    const wedding = await this.db.wedding.findUnique({
      where: { id: row.weddingId },
      select: { groomFirstName: true, groomLastName: true, organizationId: true },
    })
    if (!wedding) return { ok: false, error: 'not_found' }

    const signUpResult = await this.signUpEmail({
      body: { email: input.email, password: input.password, name: input.fullName },
    })
    const userId = signUpResult.user.id

    // The wedding already has an organization (its owner provisioned one) in
    // the common case, so link the invitee to it directly instead of calling
    // provisionWeddingWorkspace, which would mint an unintended `owner` member.
    const organizationId = wedding.organizationId
      ? wedding.organizationId
      : (
          await this.provisionWeddingWorkspace({
            weddingId: row.weddingId,
            name: `${wedding.groomFirstName} & ${wedding.groomLastName}`,
            userId,
          })
        ).organizationId

    const side = row.side ?? input.side

    try {
      await this.db.$transaction(async (tx) => {
        const current = await tx.workspaceInviteLink.findUnique({ where: { id: row.id } })
        const currentValidity = checkValidity(current)
        if (!currentValidity.valid) {
          throw new WorkspaceInviteValidationError(currentValidity.reason)
        }

        const existingMember = await tx.member.findFirst({ where: { organizationId, userId } })
        if (!existingMember) {
          await tx.member.create({
            data: {
              id: randomUUID(),
              organizationId,
              userId,
              role: row.role,
              side,
            },
          })
        }

        await tx.workspaceInviteLink.update({
          where: { id: row.id },
          data: { usedCount: { increment: 1 } },
        })
      })
    } catch (error) {
      if (error instanceof WorkspaceInviteValidationError) {
        return { ok: false, error: error.reason }
      }
      throw error
    }

    return { ok: true }
  }
}
