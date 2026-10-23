/**
 * Provisions the Better Auth organization/member workspace for a wedding.
 *
 * Idempotent: safe to call repeatedly for the same wedding (e.g. backfill +
 * creation-time call racing, or retries after a partial failure).
 */

import { randomUUID } from 'node:crypto'

import { db } from '~/server/infrastructure/database'

export const buildWeddingOrganizationSlug = (weddingId: string): string => {
  return `wedding-${weddingId}`
}

export type ProvisionWeddingWorkspaceInput = {
  weddingId: string
  name: string
  userId: string
}

export type ProvisionWeddingWorkspaceResult = {
  organizationId: string
}

export async function provisionWeddingWorkspace(
  input: ProvisionWeddingWorkspaceInput
): Promise<ProvisionWeddingWorkspaceResult> {
  const { weddingId, name, userId } = input

  return db.$transaction(async (tx) => {
    const wedding = await tx.wedding.findUnique({
      where: { id: weddingId },
      select: { organizationId: true },
    })

    if (!wedding) {
      throw new Error(`Cannot provision workspace: wedding ${weddingId} not found`)
    }

    if (wedding.organizationId) {
      return { organizationId: wedding.organizationId }
    }

    const slug = buildWeddingOrganizationSlug(weddingId)

    const organization = await tx.organization.upsert({
      where: { slug },
      create: { id: randomUUID(), name, slug },
      update: {},
    })

    const existingMember = await tx.member.findFirst({
      where: { organizationId: organization.id, userId },
    })

    if (!existingMember) {
      await tx.member.create({
        data: {
          id: randomUUID(),
          organizationId: organization.id,
          userId,
          role: 'owner',
        },
      })
    }

    await tx.wedding.update({
      where: { id: weddingId },
      data: { organizationId: organization.id },
    })

    return { organizationId: organization.id }
  })
}
