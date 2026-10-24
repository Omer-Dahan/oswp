'use client'

import { Check, Link2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { api } from '~/trpc/react'

export function TelegramConnectCard() {
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null)

  const linkedChats = api.messaging.listLinkedChats.useQuery()

  const createPairingToken = api.messaging.createPairingToken.useMutation({
    onSuccess: (data) => {
      setPendingDeepLink(data.deepLink)
      if (typeof window !== 'undefined') {
        window.open(data.deepLink, '_blank', 'noopener,noreferrer')
      }
      toast.success('פתחו את Telegram והקישו על התחלה כדי לסיים את ההתאמה.')
    },
    onError: (error) => {
      toast.error(error.message || 'יצירת קישור ההתאמה נכשלה')
    },
  })

  const revokeIdentity = api.messaging.revokeIdentity.useMutation({
    onSuccess: () => {
      void linkedChats.refetch()
      toast.success("הצ'אט ב-Telegram נותק")
    },
    onError: () => {
      toast.error("ניתוק הצ'אט ב-Telegram נכשל")
    },
  })

  return (
    <div className='space-y-4 rounded-lg border border-border p-4'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h4 className='font-medium text-foreground'>Telegram</h4>
          <p className='mt-1 text-muted-foreground text-xs'>
            שלחו הודעה ל-Etta בטלגרם. העבירו קבצי PDF של הצעות מחיר מספקים והיא תחלץ את הפרטים. אשרו
            שינויים מלוח הבקרה באתר.
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => createPairingToken.mutate({ channel: 'telegram' })}
          disabled={createPairingToken.isPending}
        >
          <Link2 className='me-2 h-3.5 w-3.5' aria-hidden='true' />
          חיבור ל-Telegram
        </Button>
      </div>

      {pendingDeepLink && (
        <div className='rounded-md border border-border bg-muted/40 p-3 text-xs'>
          <p className='flex items-center gap-1.5 text-foreground'>
            <Check className='h-3.5 w-3.5 text-green-600' aria-hidden='true' /> קישור ההתאמה נפתח
            בכרטיסייה חדשה.
          </p>
          <p className='mt-1 text-muted-foreground'>
            הקישור בתוקף ל-15 דקות. הקישו על <strong>התחלה</strong> בטלגרם כדי לסיים.
          </p>
          <a
            href={pendingDeepLink}
            target='_blank'
            rel='noopener noreferrer'
            className='mt-1 block truncate font-mono text-[0.7rem] text-primary hover:underline'
          >
            {pendingDeepLink}
          </a>
        </div>
      )}

      <div className='space-y-2'>
        <p className='font-mono text-[0.62rem] text-foreground/55 uppercase tracking-wider'>
          צ&apos;אטים מקושרים
        </p>
        {linkedChats.isLoading ? (
          <p className='text-muted-foreground text-xs'>טוען…</p>
        ) : linkedChats.data && linkedChats.data.length > 0 ? (
          <ul className='space-y-1'>
            {linkedChats.data.map((chat) => (
              <li
                key={chat.id}
                className='flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs'
              >
                <div>
                  <p className='font-medium text-foreground'>
                    {chat.displayName ?? `צ׳אט ${chat.externalChatId}`}
                  </p>
                  <p className='text-muted-foreground'>
                    חובר בתאריך {new Date(chat.linkedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => revokeIdentity.mutate({ identityId: chat.id })}
                  disabled={revokeIdentity.isPending}
                  aria-label={`ניתוק ${chat.displayName ?? chat.externalChatId}`}
                  className='text-destructive hover:text-destructive'
                >
                  <Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground text-xs'>אין צ'אטים של Telegram מקושרים עדיין.</p>
        )}
      </div>
    </div>
  )
}
