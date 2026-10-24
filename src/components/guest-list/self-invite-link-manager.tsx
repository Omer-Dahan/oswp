'use client'

import { Check, Copy, Link2, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AsyncState } from '~/components/ui/async-state'
import { Button } from '~/components/ui/button'
import { api } from '~/trpc/react'

export function SelfInviteLinkManager() {
  const [copied, setCopied] = useState(false)

  const { data: tokenData, isLoading, error, refetch } = api.selfFill.getToken.useQuery()

  const generateToken = api.selfFill.generateToken.useMutation({
    onSuccess: () => {
      void refetch()
      toast.success('קישור ההזמנה נוצר!')
    },
    onError: () => {
      toast.error('יצירת קישור ההזמנה נכשלה')
    },
  })

  const revokeToken = api.selfFill.revokeToken.useMutation({
    onSuccess: () => {
      void refetch()
      toast.success('קישור ההזמנה בוטל')
    },
    onError: () => {
      toast.error('ביטול קישור ההזמנה נכשל')
    },
  })

  const joinUrl =
    tokenData?.token && typeof window !== 'undefined'
      ? `${window.location.origin}/join/${tokenData.token}`
      : null

  const handleCopy = async () => {
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('העתקת הקישור נכשלה')
    }
  }

  if (isLoading) {
    return <AsyncState isLoading loadingText='טוען קישור הזמנה...' />
  }

  if (error) {
    if (error.data?.code === 'FORBIDDEN') {
      return (
        <p className='text-muted-foreground text-sm'>
          ניהול קישורי הזמנה דורש הרשאה לשליחת הזמנות.
        </p>
      )
    }
    return <AsyncState error='לא ניתן לטעון את קישור ההזמנה.' />
  }

  if (!tokenData?.token) {
    return (
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => generateToken.mutate({})}
        disabled={generateToken.isPending}
      >
        <Link2 className='me-2 h-3.5 w-3.5' aria-hidden='true' />
        יצירת קישור הזמנה
      </Button>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <div className='min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-3 py-2'>
          <p className='truncate font-mono text-muted-foreground text-xs'>{joinUrl}</p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleCopy}
          aria-label={copied ? 'הועתק!' : 'העתקת קישור ההזמנה'}
        >
          {copied ? (
            <Check className='h-4 w-4 text-green-600' aria-hidden='true' />
          ) : (
            <Copy className='h-4 w-4' aria-hidden='true' />
          )}
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => generateToken.mutate({})}
          disabled={generateToken.isPending}
          aria-label='איפוס קישור הזמנה'
          title='איפוס קישור (הקישור הישן יפסיק לעבוד)'
        >
          <RefreshCw
            className={`h-4 w-4 ${generateToken.isPending ? 'animate-spin' : ''}`}
            aria-hidden='true'
          />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => revokeToken.mutate({})}
          disabled={revokeToken.isPending}
          aria-label='ביטול קישור הזמנה'
          title='ביטול קישור'
          className='text-destructive hover:text-destructive'
        >
          <X className='h-4 w-4' aria-hidden='true' />
        </Button>
      </div>
      {tokenData.expiresAt && (
        <p className='text-muted-foreground text-xs'>
          תוקף הקישור יפוג ב-{new Date(tokenData.expiresAt).toLocaleDateString()}
        </p>
      )}
      {tokenData.expiresAt &&
        tokenData.earliestEventDate &&
        new Date(tokenData.expiresAt) < new Date(tokenData.earliestEventDate) && (
          <p className='text-destructive text-xs'>קישור זה יפוג לפני האירוע המוקדם ביותר שלכם</p>
        )}
    </div>
  )
}
