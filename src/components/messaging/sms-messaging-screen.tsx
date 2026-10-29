'use client'

import { Loader2, MessageSquareText, Search, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import {
  DEFAULT_SMS_INVITE_TEMPLATE,
  renderWeddingInviteSmsTemplate,
} from '~/lib/sms/invite-message'
import { api } from '~/trpc/react'

const MAX_CONSECUTIVE_FAILURES = 3
const GSM_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
)
const GSM_EXTENDED = new Set('^{}\\[~]|€')

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'
type StatusFilter = 'all' | 'pending' | 'sent' | 'failed' | 'unavailable'
type SortOption = 'name' | 'status' | 'sentAt'

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

function matchesStatus(
  recipient: { status: string | null; sendable: boolean },
  filter: StatusFilter
) {
  if (filter === 'all') return true
  if (filter === 'sent') return recipient.status === 'SENT'
  if (filter === 'failed') return recipient.status === 'FAILED'
  if (filter === 'unavailable') return !recipient.sendable && recipient.status !== 'SENT'
  return recipient.sendable && recipient.status !== 'FAILED'
}

function messageLength(text: string) {
  const characters = Array.from(text)
  const isGsm = characters.every(
    (character) => GSM_BASIC.has(character) || GSM_EXTENDED.has(character)
  )
  const units = isGsm
    ? characters.reduce((total, character) => total + (GSM_EXTENDED.has(character) ? 2 : 1), 0)
    : characters.length
  const singleLimit = isGsm ? 160 : 70
  const multipartLimit = isGsm ? 153 : 67
  return {
    characters: characters.length,
    segments:
      units === 0 ? 0 : Math.ceil(units / (units <= singleLimit ? singleLimit : multipartLimit)),
  }
}

function formatSentAt(value: Date | string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function SmsMessagingScreen() {
  const utils = api.useUtils()
  const recipientsQuery = api.sms.listSmsRecipients.useQuery()
  const templateQuery = api.sms.getSmsTemplate.useQuery()
  const sendSms = api.sms.sendSms.useMutation()
  const setSmsTemplate = api.sms.setSmsTemplate.useMutation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirmationIds, setConfirmationIds] = useState<string[]>([])
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [template, setTemplate] = useState(DEFAULT_SMS_INVITE_TEMPLATE)

  useEffect(() => {
    if (templateQuery.data !== undefined) setTemplate(templateQuery.data)
  }, [templateQuery.data])

  const recipients = recipientsQuery.data ?? []
  const selectedRecipient =
    recipients.find((recipient) => recipient.householdId === previewId) ?? recipients[0] ?? null
  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          recipients
            .map((recipient) => recipient.groupName?.trim())
            .filter((group): group is string => Boolean(group))
        )
      ).sort((a, b) => a.localeCompare(b, 'he')),
    [recipients]
  )
  const searchableRecipients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('he')
    const queryDigits = search.replace(/\D/g, '')
    return recipients.filter((recipient) => {
      if (groupFilter !== 'all' && recipient.groupName !== groupFilter) return false
      if (!query && !queryDigits) return true
      const text = [recipient.householdName, recipient.primaryContact, recipient.groupName]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('he')
      const phoneDigits = recipient.phone?.replace(/\D/g, '') ?? ''
      return text.includes(query) || Boolean(queryDigits && phoneDigits.includes(queryDigits))
    })
  }, [groupFilter, recipients, search])
  const counts = useMemo(
    () => ({
      all: searchableRecipients.length,
      pending: searchableRecipients.filter((recipient) => matchesStatus(recipient, 'pending'))
        .length,
      sent: searchableRecipients.filter((recipient) => matchesStatus(recipient, 'sent')).length,
      failed: searchableRecipients.filter((recipient) => matchesStatus(recipient, 'failed')).length,
      unavailable: searchableRecipients.filter((recipient) =>
        matchesStatus(recipient, 'unavailable')
      ).length,
    }),
    [searchableRecipients]
  )
  const filteredRecipients = useMemo(() => {
    const next = searchableRecipients.filter((recipient) => matchesStatus(recipient, statusFilter))
    return [...next].sort((a, b) => {
      if (sortBy === 'status') {
        return statusDetails(a.status).label.localeCompare(statusDetails(b.status).label, 'he')
      }
      if (sortBy === 'sentAt') {
        return (
          (b.sentAt ? new Date(b.sentAt).getTime() : 0) -
          (a.sentAt ? new Date(a.sentAt).getTime() : 0)
        )
      }
      return a.householdName.localeCompare(b.householdName, 'he')
    })
  }, [searchableRecipients, sortBy, statusFilter])
  const selectable = filteredRecipients.filter((recipient) => recipient.sendable)
  const selectedSendableIds = selectable
    .filter((recipient) => selectedIds.has(recipient.householdId))
    .map((recipient) => recipient.householdId)
  const isSending = progress !== null || sendSms.isPending
  const preview = selectedRecipient?.inviteCode
    ? renderWeddingInviteSmsTemplate({
        template,
        recipientName: selectedRecipient.primaryContact,
        inviteLink: selectedRecipient.inviteLink ?? '{קישור}',
      })
    : null
  const length = messageLength(preview ?? template)
  const statusFilters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'הכל' },
    { value: 'pending', label: 'טרם נשלח' },
    { value: 'sent', label: 'נשלח' },
    { value: 'failed', label: 'נכשל' },
    { value: 'unavailable', label: 'לא ניתן לשלוח' },
  ]

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

  const saveTemplate = async (value: string | null) => {
    const saved = await setSmsTemplate.mutateAsync({ template: value })
    setTemplate(saved)
    await Promise.all([
      utils.sms.getSmsTemplate.invalidate(),
      utils.sms.listSmsRecipients.invalidate(),
    ])
    toast.success(value === null ? 'נוסח ברירת המחדל שוחזר' : 'נוסח ההודעה נשמר')
  }

  if (recipientsQuery.isLoading || templateQuery.isLoading) {
    return (
      <div className='grid min-h-64 place-items-center' role='status' aria-label='טוען נמעני SMS'>
        <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (recipientsQuery.error || templateQuery.error) {
    return (
      <Card className='border-destructive/35'>
        <CardContent className='py-6 text-destructive text-sm'>
          {recipientsQuery.error?.message ||
            templateQuery.error?.message ||
            'טעינת מסך ה-SMS נכשלה'}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='mx-auto grid max-w-7xl gap-4' dir='rtl'>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>נוסח ההודעה</CardTitle>
          <p className='text-muted-foreground text-sm'>
            השתמשו ב־{'{שם}'} וב־{'{קישור}'} לשדות האישיים.
          </p>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Textarea
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            className='min-h-36 resize-y leading-7'
            aria-label='נוסח הודעת SMS'
          />
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <span className='font-mono text-muted-foreground text-xs'>
              {length.characters} תווים · {length.segments} חלקים
            </span>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                disabled={setSmsTemplate.isPending}
                onClick={() => void saveTemplate(null)}
              >
                שחזר לברירת מחדל
              </Button>
              <Button
                disabled={setSmsTemplate.isPending}
                onClick={() => void saveTemplate(template)}
              >
                {setSmsTemplate.isPending && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
                שמור נוסח
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0'>
          <div>
            <CardTitle className='text-xl'>הזמנות SMS — צד החתן</CardTitle>
            <p className='mt-1 text-muted-foreground text-sm'>
              מוצגים {filteredRecipients.length} מתוך {recipients.length} · נבחרו{' '}
              {selectedSendableIds.length}
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
            שלח לנבחרים המוצגים
          </Button>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3 rounded-md border bg-muted/15 p-3'>
            <fieldset className='flex flex-wrap gap-1 rounded-md bg-muted/50 p-1'>
              <legend className='sr-only'>סינון לפי סטטוס</legend>
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type='button'
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-sm px-3 py-1.5 font-mono text-xs transition-colors ${
                    statusFilter === filter.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                  }`}
                >
                  {filter.label} <span className='ms-1 tabular-nums'>{counts[filter.value]}</span>
                </button>
              ))}
            </fieldset>
            <div className='grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_180px]'>
              <div className='relative'>
                <Search className='absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='חיפוש לפי משק בית, איש קשר, טלפון או קבוצה'
                  className='ps-9'
                />
              </div>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger aria-label='סינון לפי קבוצה'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>כל הקבוצות</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger aria-label='מיון נמענים'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='name'>שם משק בית (א״ב)</SelectItem>
                  <SelectItem value='status'>סטטוס</SelectItem>
                  <SelectItem value='sentAt'>מועד שליחה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {progress && (
            <div className='rounded-md border bg-muted/30 p-3' aria-live='polite'>
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

          <label
            htmlFor='select-visible-sms-recipients'
            className='flex items-center gap-2 font-mono text-xs'
          >
            <Checkbox
              id='select-visible-sms-recipients'
              aria-label='בחר את כל המוצגים'
              checked={selectable.length > 0 && selectedSendableIds.length === selectable.length}
              disabled={selectable.length === 0 || isSending}
              onCheckedChange={(checked) =>
                setSelectedIds((current) => {
                  const next = new Set(current)
                  for (const recipient of selectable) {
                    if (checked) next.add(recipient.householdId)
                    else next.delete(recipient.householdId)
                  }
                  return next
                })
              }
            />
            בחר את כל המוצגים ({selectable.length})
          </label>

          <div className='overflow-x-auto rounded-md border border-border'>
            <table className='w-full min-w-[760px] text-sm'>
              <thead className='border-b bg-muted/35'>
                <tr>
                  <th className='w-12 px-3 py-2 text-center'>בחירה</th>
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
                {filteredRecipients.map((recipient) => {
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
                          className='font-medium underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                          onClick={() => setPreviewId(recipient.householdId)}
                        >
                          {recipient.householdName}
                        </button>
                        <div className='text-muted-foreground text-xs'>
                          {recipient.primaryContact}
                        </div>
                        {recipient.groupName && recipient.groupName !== recipient.householdName && (
                          <div className='text-muted-foreground text-xs'>{recipient.groupName}</div>
                        )}
                      </td>
                      <td className='px-3 py-3 font-mono text-xs' dir='ltr'>
                        {recipient.phone ?? '—'}
                      </td>
                      <td className='px-3 py-3'>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {recipient.status === 'SENT' && recipient.sentAt && (
                          <div className='mt-1 font-mono text-muted-foreground text-xs'>
                            {formatSentAt(recipient.sentAt)}
                          </div>
                        )}
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
                {filteredRecipients.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className='px-4 py-14 text-center font-mono text-muted-foreground text-sm'
                    >
                      לא נמצאו נמענים תואמים
                    </td>
                  </tr>
                )}
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
          {preview ? (
            <div>
              <p className='mb-2 text-muted-foreground text-xs'>
                אל {selectedRecipient?.phone ?? 'ללא מספר'}
              </p>
              <pre className='whitespace-pre-wrap rounded-md border bg-muted/20 p-4 font-sans text-sm leading-7'>
                {preview}
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
