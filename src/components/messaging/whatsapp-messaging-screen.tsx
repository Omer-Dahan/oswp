'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { WhatsappReviewPanel } from '~/components/messaging/whatsapp-review-panel'
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
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { DAILY_RECIPIENT_CAP } from '~/server/domains/whatsapp/whatsapp.rules'
import { api } from '~/trpc/react'

type AudienceMode = 'all' | 'event' | 'tag'
type OutboundKind = 'INVITE' | 'REMINDER' | 'CUSTOM'

const KIND_LABELS: Record<OutboundKind, string> = {
  INVITE: 'הזמנה',
  REMINDER: 'תזכורת',
  CUSTOM: 'מותאם',
}

const OUTBOUND_STATUS_LABELS: Record<string, string> = {
  QUEUED: 'בתור',
  SENDING: 'נשלח כעת',
  SENT: 'נשלח',
  DELIVERED: 'התקבל',
  READ: 'נקרא',
  FAILED: 'נכשל',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function outboundStatusVariant(status: string): BadgeVariant {
  if (status === 'FAILED') return 'destructive'
  if (status === 'QUEUED' || status === 'SENDING') return 'secondary'
  return 'default'
}

function templateStatusVariant(status: string | null): BadgeVariant {
  if (status === 'APPROVED') return 'default'
  if (status === 'REJECTED') return 'destructive'
  return 'secondary'
}

function templateStatusLabel(status: string | null): string {
  if (status === 'APPROVED') return 'מאושרת'
  if (status === 'REJECTED') return 'נדחתה'
  if (status === 'PENDING') return 'בבדיקה'
  return status ?? 'לא ידוע'
}

const sectionLabelClass = 'font-mono text-[0.62rem] text-foreground/55 uppercase tracking-[0.1em]'
const thClass =
  'px-3 py-2 text-end font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'

export function WhatsappMessagingScreen() {
  const utils = api.useUtils()

  const account = api.whatsapp.getAccount.useQuery()
  const templates = api.whatsapp.listTemplates.useQuery()
  const events = api.event.getAllByUserId.useQuery()
  const tags = api.guestTag.getAll.useQuery()
  const recentOutbound = api.whatsapp.listRecentOutbound.useQuery({ limit: 50 })

  const syncTemplates = api.whatsapp.syncTemplates.useMutation({
    onSuccess: () => {
      toast.success('התבניות סונכרנו מול מטא')
      void utils.whatsapp.listTemplates.invalidate()
    },
    onError: (error) => toast.error(error.message || 'סנכרון התבניות נכשל'),
  })

  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all')
  const [eventId, setEventId] = useState('')
  const [tagId, setTagId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [kind, setKind] = useState<OutboundKind>('INVITE')
  const [resend, setResend] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [queueSummary, setQueueSummary] = useState<{
    queued: number
    skipped: number
    overCap: number
  } | null>(null)
  const [isDraining, setIsDraining] = useState(false)
  const [drainTotals, setDrainTotals] = useState({ sent: 0, failed: 0 })
  const [remaining, setRemaining] = useState(0)
  const drainInFlight = useRef(false)

  const audienceReady =
    audienceMode === 'all' ||
    (audienceMode === 'event' && eventId.length > 0) ||
    (audienceMode === 'tag' && tagId.length > 0)

  const previewEnabled = templateName.length > 0 && audienceReady

  const preview = api.whatsapp.getComposePreview.useQuery(
    {
      templateName,
      eventId: audienceMode === 'event' ? eventId : undefined,
      tagId: audienceMode === 'tag' ? tagId : undefined,
    },
    { enabled: previewEnabled }
  )

  const queueBatch = api.whatsapp.queueBatch.useMutation({
    onSuccess: (result) => {
      setQueueSummary(result)
      setConfirmOpen(false)
      if (result.queued > 0) {
        setDrainTotals({ sent: 0, failed: 0 })
        setIsDraining(true)
      }
      void utils.whatsapp.listRecentOutbound.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'תזמון ההודעות נכשל')
      setConfirmOpen(false)
    },
  })

  const processQueue = api.whatsapp.processQueue.useMutation()

  const cancelQueue = api.whatsapp.cancelQueue.useMutation({
    onSuccess: () => {
      setIsDraining(false)
      void utils.whatsapp.listRecentOutbound.invalidate()
    },
  })

  useEffect(() => {
    if (!isDraining) return

    const tick = async () => {
      if (drainInFlight.current) return
      drainInFlight.current = true
      try {
        const result = await processQueue.mutateAsync({ max: 1 })
        setDrainTotals((prev) => ({
          sent: prev.sent + result.sent,
          failed: prev.failed + result.failed,
        }))
        setRemaining(result.remaining)
        void utils.whatsapp.listRecentOutbound.invalidate()
        if (result.remaining === 0 && result.processed === 0) {
          setIsDraining(false)
        }
      } catch {
        setIsDraining(false)
      } finally {
        drainInFlight.current = false
      }
    }

    void tick()
    const interval = setInterval(() => void tick(), 2000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraining])

  const handleQueue = () => {
    queueBatch.mutate({
      eventId: audienceMode === 'event' ? eventId : undefined,
      tagId: audienceMode === 'tag' ? tagId : undefined,
      templateName,
      kind,
      resend,
    })
  }

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      <ConnectionBanner account={account.data} isLoading={account.isLoading} />

      {account.data?.status === 'ACTIVE' && (
        <Tabs defaultValue='send' className='space-y-6'>
          <TabsList>
            <TabsTrigger value='send'>שליחה</TabsTrigger>
            <TabsTrigger value='review'>סקירת תשובות</TabsTrigger>
          </TabsList>
          <TabsContent value='send' className='space-y-6'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0'>
                <CardTitle className='font-serif text-xl'>תבניות</CardTitle>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => syncTemplates.mutate()}
                  disabled={!account.data?.configured || syncTemplates.isPending}
                >
                  {syncTemplates.isPending ? 'מסנכרן…' : 'רענון תבניות'}
                </Button>
              </CardHeader>
              <CardContent>
                {templates.isLoading ? (
                  <p className='text-muted-foreground text-sm'>טוען תבניות…</p>
                ) : (templates.data ?? []).length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    אין עדיין תבניות מסונכרנות. לחצו על "רענון תבניות" כדי לייבא תבניות מאושרות
                    מ-Meta.
                  </p>
                ) : (
                  <ul className='divide-y divide-border'>
                    {(templates.data ?? []).map((template) => (
                      <li
                        key={template.id}
                        className='flex items-center justify-between gap-3 py-3'
                      >
                        <div className='min-w-0'>
                          <p className='truncate font-medium text-foreground text-sm'>
                            {template.name}
                          </p>
                          {template.bodyPreview && (
                            <p className='mt-0.5 truncate text-muted-foreground text-xs'>
                              {template.bodyPreview}
                            </p>
                          )}
                        </div>
                        <Badge variant={templateStatusVariant(template.status)}>
                          {templateStatusLabel(template.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='font-serif text-xl'>שליחת הודעות</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
                <div className='space-y-2'>
                  <p className={sectionLabelClass}>נמענים</p>
                  <div className='flex flex-wrap gap-2'>
                    {(
                      [
                        ['all', 'כל משקי הבית'],
                        ['event', 'לפי אירוע'],
                        ['tag', 'לפי תגית'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type='button'
                        onClick={() => setAudienceMode(mode)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          audienceMode === mode
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-background text-foreground hover:bg-accent'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {audienceMode === 'event' && (
                    <Select value={eventId} onValueChange={setEventId}>
                      <SelectTrigger className='mt-2'>
                        <SelectValue placeholder='בחרו אירוע' />
                      </SelectTrigger>
                      <SelectContent>
                        {(events.data ?? []).map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {audienceMode === 'tag' && (
                    <Select value={tagId} onValueChange={setTagId}>
                      <SelectTrigger className='mt-2'>
                        <SelectValue placeholder='בחרו תגית' />
                      </SelectTrigger>
                      <SelectContent>
                        {(tags.data ?? []).map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            {tag.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <p className={sectionLabelClass}>תבנית</p>
                    <Select value={templateName} onValueChange={setTemplateName}>
                      <SelectTrigger>
                        <SelectValue placeholder='בחרו תבנית' />
                      </SelectTrigger>
                      <SelectContent>
                        {(templates.data ?? [])
                          .filter((t) => t.status === 'APPROVED')
                          .map((template) => (
                            <SelectItem key={template.id} value={template.name}>
                              {template.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <p className={sectionLabelClass}>סוג הודעה</p>
                    <Select value={kind} onValueChange={(value) => setKind(value as OutboundKind)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(KIND_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className='flex items-center gap-2'>
                  <Checkbox
                    id='resend'
                    checked={resend}
                    onCheckedChange={(checked) => setResend(checked === true)}
                  />
                  <Label htmlFor='resend' className='text-muted-foreground text-sm'>
                    שליחה חוזרת גם למי שכבר קיבל הודעה מהתבנית הזו
                  </Label>
                </div>

                {previewEnabled && (
                  <div className='rounded-md border border-border/60 bg-muted/20 p-3'>
                    <p className={sectionLabelClass}>תצוגה מקדימה</p>
                    {preview.isLoading ? (
                      <p className='mt-1 text-muted-foreground text-sm'>טוען…</p>
                    ) : preview.data && preview.data.recipientCount > 0 ? (
                      <>
                        <p className='mt-1 whitespace-pre-wrap text-foreground text-sm'>
                          {preview.data.previewText || 'לתבנית זו אין תוכן מסונכרן לתצוגה מקדימה'}
                        </p>
                        <p className='mt-2 text-muted-foreground text-xs'>
                          {preview.data.recipientCount} נמענים מתאימים לבחירה זו
                        </p>
                      </>
                    ) : (
                      <p className='mt-1 text-muted-foreground text-sm'>
                        לא נמצאו נמענים עם מספר טלפון עבור הבחירה הזו
                      </p>
                    )}
                  </div>
                )}

                {queueSummary && (
                  <p className='text-foreground text-sm'>
                    יישלחו {queueSummary.queued} · ידולגו {queueSummary.skipped} (כבר נשלחו) ·{' '}
                    {queueSummary.overCap} חורגות מהתקרה
                  </p>
                )}

                <Button
                  type='button'
                  onClick={() => setConfirmOpen(true)}
                  disabled={
                    !previewEnabled ||
                    account.data?.status !== 'ACTIVE' ||
                    queueBatch.isPending ||
                    (preview.data?.recipientCount ?? 0) === 0
                  }
                >
                  תזמון שליחה
                </Button>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>לתזמן את השליחה?</AlertDialogTitle>
                      <AlertDialogDescription>
                        התקרה היומית היא {DAILY_RECIPIENT_CAP} נמענים ייחודיים בוואטסאפ בכל 24 שעות;
                        נמענים שחורגים מהתקרה לא יתווספו לתור.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={handleQueue}>תזמנו שליחה</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            {(isDraining || drainTotals.sent > 0 || drainTotals.failed > 0) && (
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0'>
                  <CardTitle className='font-serif text-xl'>התקדמות שליחה</CardTitle>
                  {isDraining && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => cancelQueue.mutate()}
                      disabled={cancelQueue.isPending}
                    >
                      עצור
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <p className='text-foreground text-sm'>
                    נשלחו {drainTotals.sent} · נכשלו {drainTotals.failed} · נותרו {remaining}
                  </p>
                  {!isDraining && remaining === 0 && (
                    <p className='mt-1 text-muted-foreground text-xs'>השליחה הסתיימה</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className='font-serif text-xl'>שליחות אחרונות</CardTitle>
              </CardHeader>
              <CardContent>
                {recentOutbound.isLoading ? (
                  <p className='text-muted-foreground text-sm'>טוען…</p>
                ) : (recentOutbound.data ?? []).length === 0 ? (
                  <p className='text-muted-foreground text-sm'>אין עדיין הודעות שנשלחו</p>
                ) : (
                  <div className='overflow-x-auto rounded-md border border-border'>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-border border-b bg-muted/40'>
                          <th className={thClass}>תבנית</th>
                          <th className={thClass}>סוג</th>
                          <th className={thClass}>סטטוס</th>
                          <th className={thClass}>תאריך</th>
                          <th className={thClass}>שגיאה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(recentOutbound.data ?? []).map((row) => (
                          <tr key={row.id} className='border-border border-b last:border-0'>
                            <td className='px-3 py-2'>{row.templateName}</td>
                            <td className='px-3 py-2 text-muted-foreground'>
                              {KIND_LABELS[row.kind as OutboundKind] ?? row.kind}
                            </td>
                            <td className='px-3 py-2'>
                              <Badge variant={outboundStatusVariant(row.status)}>
                                {OUTBOUND_STATUS_LABELS[row.status] ?? row.status}
                              </Badge>
                            </td>
                            <td className='px-3 py-2 text-muted-foreground'>
                              {new Date(row.sentAt ?? row.queuedAt).toLocaleString('he-IL')}
                            </td>
                            <td className='px-3 py-2 text-destructive text-xs'>
                              {row.error ?? ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value='review'>
            <WhatsappReviewPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

type AccountView =
  | {
      status: 'ACTIVE' | 'ERROR' | 'UNCONFIGURED'
      verifiedName: string | null
      displayPhoneNumber: string | null
      lastError: string | null
    }
  | undefined

function ConnectionBanner({ account, isLoading }: { account: AccountView; isLoading: boolean }) {
  if (isLoading || !account) {
    return <div className='h-14 rounded-md border border-border/50 bg-muted/20' />
  }

  if (account.status === 'ACTIVE') {
    return (
      <div className='rounded-md border border-green-600/30 bg-green-600/10 p-4'>
        <p className='font-medium text-green-700 text-sm'>
          מחובר{account.verifiedName ? ` · ${account.verifiedName}` : ''}
          {account.displayPhoneNumber ? ` · ${account.displayPhoneNumber}` : ''}
        </p>
      </div>
    )
  }

  if (account.status === 'ERROR') {
    return (
      <div className='rounded-md border border-destructive/30 bg-destructive/10 p-4'>
        <p className='font-medium text-destructive text-sm'>החיבור לוואטסאפ נכשל</p>
        {account.lastError && (
          <p className='mt-1 text-destructive/80 text-xs'>{account.lastError}</p>
        )}
      </div>
    )
  }

  return (
    <div className='rounded-md border border-amber-600/30 bg-amber-600/10 p-4'>
      <p className='font-medium text-amber-700 text-sm'>
        לא מחובר ·{' '}
        <Link href='/settings' className='underline underline-offset-2 hover:text-amber-800'>
          חברו את חשבון הוואטסאפ בהגדרות
        </Link>
      </p>
    </div>
  )
}
