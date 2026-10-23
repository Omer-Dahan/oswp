/**
 * WhatsApp Domain - Repository
 */

import type { PrismaClient, WhatsAppAccountStatus } from '@prisma/client'

import type { WhatsAppAccount } from '~/server/domains/whatsapp/whatsapp.types'

export class WhatsAppRepository {
  constructor(private db: PrismaClient) {}

  async findAccountByWeddingId(weddingId: string): Promise<WhatsAppAccount | null> {
    return this.db.whatsAppAccount.findUnique({ where: { weddingId } })
  }

  async upsertAccount(
    weddingId: string,
    data: {
      phoneNumberId: string
      wabaId: string
      accessTokenEnc: string
      verifyToken: string
    }
  ): Promise<WhatsAppAccount> {
    return this.db.whatsAppAccount.upsert({
      where: { weddingId },
      create: {
        weddingId,
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        accessTokenEnc: data.accessTokenEnc,
        verifyToken: data.verifyToken,
        status: 'UNCONFIGURED',
      },
      update: {
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        accessTokenEnc: data.accessTokenEnc,
        verifyToken: data.verifyToken,
        status: 'UNCONFIGURED',
        displayPhoneNumber: null,
        verifiedName: null,
        lastError: null,
      },
    })
  }

  async updateConnectionResult(
    weddingId: string,
    data: {
      status: WhatsAppAccountStatus
      displayPhoneNumber: string | null
      verifiedName: string | null
      lastError: string | null
    }
  ): Promise<WhatsAppAccount> {
    return this.db.whatsAppAccount.update({
      where: { weddingId },
      data: {
        status: data.status,
        displayPhoneNumber: data.displayPhoneNumber,
        verifiedName: data.verifiedName,
        lastError: data.lastError,
        lastCheckedAt: new Date(),
      },
    })
  }
}
