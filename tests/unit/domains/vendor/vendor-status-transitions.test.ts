import { VendorStatus } from '@prisma/client'

import {
  canTransition,
  VENDOR_STATUS_TRANSITIONS,
} from '~/server/domains/vendor/vendor-status-transitions'

describe('vendor status transitions', () => {
  it.each(
    Object.entries(VENDOR_STATUS_TRANSITIONS).flatMap(([from, destinations]) =>
      destinations.map((to) => [from, to] as const)
    )
  )('allows %s -> %s', (from, to) => {
    expect(canTransition(from as VendorStatus, to)).toBe(true)
  })

  it.each([
    [VendorStatus.SELECTED, VendorStatus.IN_REVIEW],
    [VendorStatus.NOT_AVAILABLE, VendorStatus.SELECTED],
    [VendorStatus.DECLINED, VendorStatus.SELECTED],
    [VendorStatus.SELECTED, VendorStatus.NOT_AVAILABLE],
  ])('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })

  it.each(Object.values(VendorStatus))('allows %s -> %s as a no-op', (status) => {
    expect(canTransition(status, status)).toBe(true)
  })
})
