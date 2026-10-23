/**
 * WhatsApp Domain - Service
 */

import { TRPCError } from '@trpc/server'

import type { AuthzContext } from '~/server/authz/authorization.types'
import { requirePermission } from '~/server/authz/permission-checker'
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from '~/server/infrastructure/crypto/secrets'
import type { WhatsAppRepository } from '~/server/domains/whatsapp/whatsapp.repository'
import type { SaveAccountInput } from '~/server/domains/whatsapp/whatsapp.validator'
import type {
  WhatsAppAccountView,
  WhatsAppTestConnectionResult,
} from '~/server/domains/whatsapp/whatsapp.types'

const GRAPH_API_VERSION = 'v23.0'

export class WhatsAppService {
  constructor(private repo: WhatsAppRepository) {}

  async getAccount(ctx: AuthzContext, weddingId: string): Promise<WhatsAppAccountView> {
    requirePermission(ctx, { wedding: ['read'] })

    const account = await this.repo.findAccountByWeddingId(weddingId)
    if (!account) {
      return {
        configured: false,
        phoneNumberId: null,
        wabaId: null,
        accessTokenMasked: null,
        displayPhoneNumber: null,
        verifiedName: null,
        status: 'UNCONFIGURED',
        lastCheckedAt: null,
        lastError: null,
      }
    }

    return {
      configured: true,
      phoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,
      accessTokenMasked: account.accessTokenEnc
        ? maskSecret(decryptSecret(account.accessTokenEnc))
        : null,
      displayPhoneNumber: account.displayPhoneNumber,
      verifiedName: account.verifiedName,
      status: account.status,
      lastCheckedAt: account.lastCheckedAt,
      lastError: account.lastError,
    }
  }

  async saveAccount(
    ctx: AuthzContext,
    weddingId: string,
    input: SaveAccountInput
  ): Promise<WhatsAppAccountView> {
    requirePermission(ctx, { wedding: ['update'] })

    const account = await this.repo.upsertAccount(weddingId, {
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId,
      accessTokenEnc: encryptSecret(input.accessToken),
      verifyToken: input.verifyToken,
    })

    return {
      configured: true,
      phoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,
      accessTokenMasked: maskSecret(input.accessToken),
      displayPhoneNumber: account.displayPhoneNumber,
      verifiedName: account.verifiedName,
      status: account.status,
      lastCheckedAt: account.lastCheckedAt,
      lastError: account.lastError,
    }
  }

  async testConnection(
    ctx: AuthzContext,
    weddingId: string
  ): Promise<WhatsAppTestConnectionResult> {
    requirePermission(ctx, { wedding: ['update'] })

    const account = await this.repo.findAccountByWeddingId(weddingId)
    if (!account?.phoneNumberId || !account.accessTokenEnc) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'WhatsApp account is not configured yet',
      })
    }

    const accessToken = decryptSecret(account.accessTokenEnc)
    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${account.phoneNumberId}`)
    url.searchParams.set('fields', 'display_phone_number,verified_name,quality_rating')

    let result: WhatsAppTestConnectionResult
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = (await response.json()) as {
        display_phone_number?: string
        verified_name?: string
        error?: { message?: string }
      }

      if (!response.ok) {
        result = {
          status: 'ERROR',
          displayPhoneNumber: null,
          verifiedName: null,
          error: body.error?.message ?? `Meta API returned HTTP ${response.status}`,
        }
      } else {
        result = {
          status: 'ACTIVE',
          displayPhoneNumber: body.display_phone_number ?? null,
          verifiedName: body.verified_name ?? null,
          error: null,
        }
      }
    } catch {
      result = {
        status: 'ERROR',
        displayPhoneNumber: null,
        verifiedName: null,
        error: 'Could not reach the Meta Graph API',
      }
    }

    await this.repo.updateConnectionResult(weddingId, {
      status: result.status,
      displayPhoneNumber: result.displayPhoneNumber,
      verifiedName: result.verifiedName,
      lastError: result.error,
    })

    return result
  }
}
