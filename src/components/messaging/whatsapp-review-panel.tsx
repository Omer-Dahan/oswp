'use client'

import { useEffect, useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '~/trpc/react'
import type { RouterOutputs } from '~/trpc/shared'

type PendingInboundRow = RouterOutputs['whatsapp']['listPendingInbound'][number]
type HouseholdSearchResult = RouterOutputs['household']['findBySearch'][number]
type Decision = 'attending' | 'declined' | 'dismissed'

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

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
  'px-3 py-2 text-end font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'
const sectionLabelClass = 'font-mono text-[0.62rem] text-foreground/55 uppercase tracking-[0.1em]'

const DECISION_LABELS: Record<Decision, string> = {
  attending: 'אשר הגעה',
  declined: 'אשר אי-הגעה',
  dismissed: 'התעלם',
}

function guestOptionLabel(guest: { firstName: string; lastName: string }): string {
  return `${guest.firstName} ${guest.lastName}`.trim()
}

type LinkHouseholdDialogProps = {
  row: PendingInboundRow | null
  onOpenChange: (open: boolean) => void
  onLinked: (inboundId: string) => void
}

function LinkHouseholdDialog({ row, onOpenChange, onLinked }: LinkHouseholdDialogProps) {
  const [searchText, setSearchText] = useState('')
  const debouncedSearchText = useDebouncedValue(searchText, 300)
  const [selectedGuest, setSelectedGuest] = useState<{ id: number; label: string } | null>(null)
  const [replaceConfirm, setReplaceConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (!row) {
      setSearchText('')
      setSelectedGuest(null)
      setReplaceConfirm(null)
    }
  }, [row])

  const search = api.household.findBySearch.useQuery(
    { searchText: debouncedSearchText },
    { enabled: debouncedSearchText.trim().length >= 2 }
  )

  const linkInbound = api.whatsapp.linkInboundToHousehold.useMutation({
    onSuccess: () => {
      if (!row) return
      toast.success('הטלפון שויך למשק הבית')
      onLinked(row.id)
    },
    onError: (error) => {
      if (error.data?.code === 'CONFLICT') {
        setReplaceConfirm(error.message)
        return
      }
      toast.error(error.message || 'השיוך נכשל')
    },
  })

  const results: HouseholdSearchResult[] = search.data ?? []

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>שייך למשק בית</DialogTitle>
          <DialogDescription>
            הטלפון {row?.fromPhone} יישמר על האורח שתבחרו, כדי שתשובות עתידיות יזוהו אוטומטית.
          </DialogDescription>
        </DialogHeader>

        {replaceConfirm ? (
          <div className='space-y-3'>
            <p className='text-sm'>{replaceConfirm}</p>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setReplaceConfirm(null)}>
                ביטול
              </Button>
              <Button
                type='button'
                disabled={linkInbound.isPending}
                onClick={() => {
                  if (!row || !selectedGuest) return
                  linkInbound.mutate({
                    inboundId: row.id,
                    guestId: selectedGuest.id,
                    replacePhone: true,
                  })
                }}
              >
                החלף טלפון ושייך
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className='space-y-3'>
            <Input
              placeholder='חיפוש לפי שם משק בית או אורח'
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                setSelectedGuest(null)
              }}
            />

            <div className='max-h-64 space-y-1 overflow-y-auto'>
              {search.isFetching ? (
                <p className={sectionLabelClass}>מחפש...</p>
              ) : debouncedSearchText.trim().length < 2 ? (
                <p className={sectionLabelClass}>הקלידו לפחות 2 תווים לחיפוש</p>
              ) : results.length === 0 ? (
                <p className={sectionLabelClass}>לא נמצאו משקי בית מתאימים</p>
              ) : (
                results.map((household) => (
                  <div key={household.id} className='rounded-md border border-border p-2'>
                    <p className={sectionLabelClass}>משק בית</p>
                    <div className='mt-1 flex flex-wrap gap-2'>
                      {household.guests.map((guest) => {
                        const label = guestOptionLabel(guest)
                        const isSelected = selectedGuest?.id === guest.id
                        return (
                          <Button
                            key={guest.id}
                            type='button'
                            size='sm'
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => setSelectedGuest({ id: guest.id, label })}
                          >
                            {label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
              <Button
                type='button'
                disabled={!selectedGuest || linkInbound.isPending}
                onClick={() => {
                  if (!row || !selectedGuest) return
                  linkInbound.mutate({ inboundId: row.id, guestId: selectedGuest.id })
                }}
              >
                שייך
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function WhatsappReviewPanel() {
  const utils = api.useUtils()
  const pending = api.whatsapp.listPendingInbound.useQuery({ limit: 50 })

  const [confirmTarget, setConfirmTarget] = useState<{
    row: PendingInboundRow
    decision: Decision
  } | null>(null)
  const [linkTarget, setLinkTarget] = useState<PendingInboundRow | null>(null)

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
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => setLinkTarget(row)}
                      >
                        שייך למשק בית
                      </Button>
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

      <LinkHouseholdDialog
        row={linkTarget}
        onOpenChange={(open) => !open && setLinkTarget(null)}
        onLinked={() => {
          void utils.whatsapp.listPendingInbound.invalidate()
          setLinkTarget(null)
        }}
      />
    </div>
  )
}
