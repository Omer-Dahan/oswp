'use client'

import { Loader2, MessageSquareText, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import { api } from '~/trpc/react'

const MAX_CONSECUTIVE_FAILURES = 3

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function statusDetails(status: string | null): { label: string; variant: BadgeVariant } {
  if (status === 'SENT') return { label: 'נשלח', variant: 'default' }
  if (status === 'FAILED') return { label: 'נכשל', variant: 'destructive' }
  if (status === 'QUEUED') return { label: 'ממתין', variant: 'secondary' }
  return { label: 'טרם נשלח', variant: 'outline' }
}

function unavailableReason(recipient: {
  inviteCode: string | null
  phone: string | null
  status: string | null
}): string | null {
  if (recipient.status === 'SENT') return null
  if (!recipient.inviteCode) return 'חסר קוד הזמנה'
  if (!recipient.phone) return 'חסר מספר טלפון תקין'
  return null
}

export function SmsMessagingScreen() {
  const utils = api.useUtils()
  const recipientsQuery = api.sms.listSmsRecipients.useQuery()
  const sendSms = api.sms.sendSms.useMutation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirmationIds, setConfirmationIds] = useState<string[]>([])
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)

  const recipients = recipientsQuery.data ?? []
  const selectedRecipient =
    recipients.find((recipient) => recipient.householdId === previewId) ?? recipients[0] ?? null
  const counts = useMemo(
    () => ({
      pending: recipients.filter(
        (recipient) => recipient.status !== 'SENT' && recipient.status !== 'FAILED'
      ).length,
      sent: recipients.filter((recipient) => recipient.status === 'SENT').length,
      failed: recipients.filter((recipient) => recipient.status === 'FAILED').length,
    }),
    [recipients]
  )
  const selectable = recipients.filter((recipient) => recipient.sendable)
  const selectedSendableIds = selectable
    .filter((recipient) => selectedIds.has(recipient.householdId))
    .map((recipient) => recipient.householdId)
  const isSending = progress !== null || sendSms.isPending

  const toggleRecipient = (householdId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(householdId)
      else next.delete(householdId)
      return next
    })
  }

  const runSend = async () => {
    const ids = confirmationIds
    setConfirmationIds([])
    setProgress({ completed: 0, total: ids.length })
    let consecutiveFailures = 0

    for (const [index, householdId] of ids.entries()) {
      try {
        const result = await sendSms.mutateAsync({ householdId })
        consecutiveFailures = result.status === 'FAILED' ? consecutiveFailures + 1 : 0
      } catch {
        consecutiveFailures += 1
      }
      setProgress({ completed: index + 1, total: ids.length })
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        toast.error('השליחה נעצרה לאחר שלושה כישלונות רצופים')
        break
      }
    }

    setProgress(null)
    setSelectedIds(new Set())
    await utils.sms.listSmsRecipients.invalidate()
    toast.success(ids.length === 1 ? 'השליחה הסתיימה' : 'ריצת השליחה הסתיימה')
  }

  if (recipientsQuery.isLoading) {
    return (
      <div className='grid min-h-64 place-items-center' role='status' aria-label='טוען נמעני SMS'>
        <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (recipientsQuery.error) {
    return (
      <Card className='border-destructive/35'>
        <CardContent className='py-6 text-destructive text-sm'>
          {recipientsQuery.error.message || 'טעינת נמעני ה-SMS נכשלה'}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='mx-auto grid max-w-7xl gap-4' dir='rtl'>
      <Card>
        <CardHeader className='gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0'>
          <div>
            <CardTitle className='text-xl'>הזמנות SMS — צד החתן</CardTitle>
            <p className='mt-1 text-muted-foreground text-sm'>
              ממתינים {counts.pending} · נשלחו {counts.sent} · נכשלו {counts.failed}
            </p>
          </div>
          <Button
            disabled={selectedSendableIds.length === 0 || isSending}
            onClick={() => setConfirmationIds(selectedSendableIds)}
          >
            {progress ? (
              <Loader2 className='me-2 h-4 w-4 animate-spin' />
            ) : (
              <Send className='me-2 h-4 w-4' />
            )}
            שלח לנבחרים
          </Button>
        </CardHeader>
        <CardContent>
          {progress && (
            <div className='mb-4 rounded-md border bg-muted/30 p-3' aria-live='polite'>
              <div className='mb-2 flex justify-between font-mono text-xs'>
                <span>שולח הודעות אחת־אחת</span>
                <span>
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
                <div
                  className='h-full bg-primary transition-[width]'
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className='overflow-x-auto rounded-md border border-border'>
            <table className='w-full min-w-[680px] text-sm'>
              <thead className='border-b bg-muted/35'>
                <tr>
                  <th className='w-12 px-3 py-2 text-center'>
                    <Checkbox
                      aria-label='בחר את כל הנמענים הזמינים'
                      checked={
                        selectable.length > 0 && selectedSendableIds.length === selectable.length
                      }
                      disabled={selectable.length === 0 || isSending}
                      onCheckedChange={(checked) =>
                        setSelectedIds(
                          checked
                            ? new Set(selectable.map((recipient) => recipient.householdId))
                            : new Set()
                        )
                      }
                    />
                  </th>
                  <th className='px-3 py-2 text-start font-mono text-muted-foreground text-xs'>
                    משק בית
                  </th>
                  <th className='px-3 py-2 text-start font-mono text-muted-foreground text-xs'>
                    טלפון
                  </th>
                  <th className='px-3 py-2 text-start font-mono text-muted-foreground text-xs'>
                    סטטוס
                  </th>
                  <th className='px-3 py-2 text-end font-mono text-muted-foreground text-xs'>
                    פעולה
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {recipients.map((recipient) => {
                  const status = statusDetails(recipient.status)
                  const reason = unavailableReason(recipient)
                  return (
                    <tr key={recipient.householdId} className='transition-colors hover:bg-muted/25'>
                      <td className='px-3 py-3 text-center'>
                        <Checkbox
                          aria-label={`בחר ${recipient.householdName}`}
                          checked={selectedIds.has(recipient.householdId)}
                          disabled={!recipient.sendable || isSending}
                          onCheckedChange={(checked) =>
                            toggleRecipient(recipient.householdId, checked === true)
                          }
                        />
                      </td>
                      <td className='px-3 py-3'>
                        <button
                          type='button'
                          className='font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                          onClick={() => setPreviewId(recipient.householdId)}
                        >
                          {recipient.householdName}
                        </button>
                        <div className='text-muted-foreground text-xs'>
                          {recipient.primaryContact}
                        </div>
                      </td>
                      <td className='px-3 py-3 font-mono text-xs' dir='ltr'>
                        {recipient.phone ?? '—'}
                      </td>
                      <td className='px-3 py-3'>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {reason && (
                          <div className='mt-1 text-muted-foreground text-xs'>{reason}</div>
                        )}
                        {recipient.status === 'FAILED' && recipient.error && (
                          <div className='mt-1 max-w-64 text-destructive text-xs'>
                            {recipient.error}
                          </div>
                        )}
                      </td>
                      <td className='px-3 py-3 text-end'>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={!recipient.sendable || isSending}
                          onClick={() => setConfirmationIds([recipient.householdId])}
                        >
                          שלח
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <MessageSquareText className='h-4 w-4 text-primary' />
            תצוגה מקדימה
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedRecipient?.preview ? (
            <div>
              <p className='mb-2 text-muted-foreground text-xs'>
                אל {selectedRecipient.phone ?? 'ללא מספר'}
              </p>
              <pre className='whitespace-pre-wrap rounded-md border bg-muted/20 p-4 font-sans text-sm leading-7'>
                {selectedRecipient.preview}
              </pre>
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              בחרו משק בית עם קוד הזמנה כדי לראות את ההודעה.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmationIds.length > 0}
        onOpenChange={(open) => !open && setConfirmationIds([])}
      >
        <AlertDialogContent dir='rtl'>
          <AlertDialogHeader>
            <AlertDialogTitle>לאשר שליחת SMS?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationIds.length === 1
                ? 'ההודעה תישלח כעת למשק הבית שבחרתם.'
                : `${confirmationIds.length} הודעות יישלחו אחת־אחת. הריצה תיעצר לאחר שלושה כישלונות רצופים.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runSend()}>אישור ושליחה</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
