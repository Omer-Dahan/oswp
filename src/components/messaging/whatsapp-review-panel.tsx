'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '~/trpc/react'
import type { RouterOutputs } from '~/trpc/shared'

type PendingInboundRow = RouterOutputs['whatsapp']['listPendingInbound'][number]
type Decision = 'attending' | 'declined' | 'dismissed'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const INTENT_LABELS: Record<string, string> = {
  attending: 'מגיעים',
  declined: 'לא מגיעים',
  unknown: 'לא ברור',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'בטחון גבוה',
  low: 'בטחון נמוך',
}

function intentVariant(intent: string | undefined): BadgeVariant {
  if (intent === 'attending') return 'default'
  if (intent === 'declined') return 'destructive'
  return 'secondary'
}

const thClass =
  'px-3 py-2 text-right font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'
const sectionLabelClass = 'font-mono text-[0.62rem] text-foreground/55 uppercase tracking-[0.1em]'

const DECISION_LABELS: Record<Decision, string> = {
  attending: 'אשר הגעה',
  declined: 'אשר אי-הגעה',
  dismissed: 'התעלם',
}

export function WhatsappReviewPanel() {
  const utils = api.useUtils()
  const pending = api.whatsapp.listPendingInbound.useQuery({ limit: 50 })

  const [confirmTarget, setConfirmTarget] = useState<{
    row: PendingInboundRow
    decision: Decision
  } | null>(null)

  const resolveInbound = api.whatsapp.resolveInbound.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(variables.decision === 'dismissed' ? 'ההודעה הוסרה מהבדיקה' : 'ההזמנה עודכנה')
      utils.whatsapp.listPendingInbound.setData({ limit: 50 }, (current) =>
        current?.filter((row) => row.id !== variables.inboundId)
      )
      setConfirmTarget(null)
    },
    onError: (error) => {
      toast.error(error.message || 'העדכון נכשל')
      setConfirmTarget(null)
    },
  })

  const rows = pending.data ?? []

  return (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>
        ספירת האנשים בהודעה היא מידע בלבד ולא משפיעה על כמות ההזמנות שמתעדכנות.
      </p>

      {pending.isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
        </div>
      ) : rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>אין תשובות שממתינות לבדיקה</p>
      ) : (
        <div className='overflow-x-auto rounded-md border border-border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-border border-b bg-muted/40'>
                <th className={thClass}>זמן</th>
                <th className={thClass}>שולח</th>
                <th className={thClass}>טלפון</th>
                <th className={thClass}>הודעה</th>
                <th className={thClass}>פענוח</th>
                <th className={thClass}>משק בית</th>
                <th className={thClass}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className='border-border border-b last:border-0 align-top'>
                  <td className='whitespace-nowrap px-3 py-2 text-muted-foreground'>
                    {new Date(row.receivedAt).toLocaleString('he-IL')}
                  </td>
                  <td className='px-3 py-2'>{row.guestName ?? 'לא ידוע'}</td>
                  <td className='whitespace-nowrap px-3 py-2 text-muted-foreground'>
                    {row.fromPhone}
                  </td>
                  <td className='max-w-xs px-3 py-2'>{row.text ?? ''}</td>
                  <td className='px-3 py-2'>
                    <div className='flex flex-wrap gap-1'>
                      <Badge variant={intentVariant(row.parsed?.intent)}>
                        {INTENT_LABELS[row.parsed?.intent ?? 'unknown'] ?? 'לא ברור'}
                      </Badge>
                      {row.parsed?.confidence && (
                        <Badge variant='outline'>{CONFIDENCE_LABELS[row.parsed.confidence]}</Badge>
                      )}
                      {row.parsed?.headcount != null && (
                        <Badge variant='outline'>{row.parsed.headcount} אנשים</Badge>
                      )}
                    </div>
                  </td>
                  <td className='px-3 py-2'>
                    {row.householdUnmatched ? (
                      <span className='text-destructive text-xs'>טלפון לא משויך</span>
                    ) : (
                      (row.householdLabel ?? '-')
                    )}
                  </td>
                  <td className='px-3 py-2'>
                    {row.householdUnmatched ? (
                      <span className='text-muted-foreground text-xs'>לא ניתן לפעול</span>
                    ) : (
                      <div className='flex flex-wrap gap-2'>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={() => setConfirmTarget({ row, decision: 'attending' })}
                        >
                          {DECISION_LABELS.attending}
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={() => setConfirmTarget({ row, decision: 'declined' })}
                        >
                          {DECISION_LABELS.declined}
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='ghost'
                          onClick={() => setConfirmTarget({ row, decision: 'dismissed' })}
                        >
                          {DECISION_LABELS.dismissed}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget ? `${DECISION_LABELS[confirmTarget.decision]}?` : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.decision === 'dismissed' ? (
                <span className={sectionLabelClass}>
                  ההודעה תוסר מרשימת הבדיקה בלי לעדכן הזמנות
                </span>
              ) : (
                <span>
                  הפעולה תעדכן את ההזמנות של משק הבית {confirmTarget?.row.householdLabel ?? ''}{' '}
                  בהתאם לתשובה הזו.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              disabled={resolveInbound.isPending}
              onClick={() => {
                if (!confirmTarget) return
                resolveInbound.mutate({
                  inboundId: confirmTarget.row.id,
                  decision: confirmTarget.decision,
                })
              }}
            >
              אישור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
