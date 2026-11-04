'use client'

import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

type GuestListLoadingIndicatorProps = {
  loading: boolean
  refetching?: boolean
  delay?: number
}

export function GuestListLoadingIndicator({
  loading,
  refetching = false,
  delay = 250,
}: GuestListLoadingIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!loading) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [delay, loading])

  if (!visible) return null

  return (
    <div
      className='fixed start-1/2 bottom-4 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1.5 font-mono text-muted-foreground text-xs shadow-sm'
      role='status'
      aria-label={refetching ? 'טוען מחדש' : 'טוען'}
    >
      <LoaderCircle className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />
      {refetching ? null : <span>טוען…</span>}
    </div>
  )
}
