import { TRPCError } from '@trpc/server'

export const requireActiveWeddingId = (weddingId: string | null): string => {
  if (!weddingId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'לא נמצאה חתונה פעילה',
    })
  }

  return weddingId
}
