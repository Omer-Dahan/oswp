import { VendorStatus } from '@prisma/client'

export const VENDOR_STATUS_TRANSITIONS: Record<VendorStatus, readonly VendorStatus[]> = {
  [VendorStatus.IN_REVIEW]: [
    VendorStatus.PRE_SELECTED,
    VendorStatus.DECLINED,
    VendorStatus.NOT_AVAILABLE,
  ],
  [VendorStatus.PRE_SELECTED]: [
    VendorStatus.IN_REVIEW,
    VendorStatus.IN_NEGOTIATION,
    VendorStatus.DECLINED,
    VendorStatus.NOT_AVAILABLE,
  ],
  [VendorStatus.IN_NEGOTIATION]: [
    VendorStatus.PRE_SELECTED,
    VendorStatus.SELECTED,
    VendorStatus.DECLINED,
    VendorStatus.NOT_AVAILABLE,
  ],
  [VendorStatus.SELECTED]: [VendorStatus.IN_NEGOTIATION],
  [VendorStatus.DECLINED]: [VendorStatus.IN_REVIEW],
  [VendorStatus.NOT_AVAILABLE]: [VendorStatus.IN_REVIEW],
}

export function canTransition(from: VendorStatus, to: VendorStatus): boolean {
  return from === to || VENDOR_STATUS_TRANSITIONS[from].includes(to)
}
