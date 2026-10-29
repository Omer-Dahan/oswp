'use client'

import { Loader2, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { api } from '~/trpc/react'
import type { RouterOutputs } from '~/trpc/shared'

type Sender = RouterOutputs['sms']['listSmsSenders'][number]

const EMPTY_FORM = {
  label: '',
  side: 'חתן' as 'חתן' | 'כלה',
  gatewayUrl: 'https://api.sms-gate.app',
  username: '',
  password: '',
  deviceId: '',
}

export function SmsSenderManagement() {
  const utils = api.useUtils()
  const sendersQuery = api.sms.listSmsSenders.useQuery()
  const createSender = api.sms.createSmsSender.useMutation()
  const updateSender = api.sms.updateSmsSender.useMutation()
  const setDefault = api.sms.setDefaultSmsSender.useMutation()
  const setActive = api.sms.setSmsSenderActive.useMutation()
  const [editing, setEditing] = useState<Sender | null | undefined>(undefined)
  const [form, setForm] = useState(EMPTY_FORM)

  const busy =
    createSender.isPending || updateSender.isPending || setDefault.isPending || setActive.isPending

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
  }

  const openEdit = (sender: Sender) => {
    setForm({
      label: sender.label,
      side: sender.side as 'חתן' | 'כלה',
      gatewayUrl: sender.gatewayUrl,
      username: '',
      password: '',
      deviceId: sender.deviceId ?? '',
    })
    setEditing(sender)
  }

  const refresh = async () => {
    await utils.sms.listSmsSenders.invalidate()
  }

  const save = async () => {
    if (editing) {
      await updateSender.mutateAsync({
        id: editing.id,
        label: form.label,
        side: form.side,
        gatewayUrl: form.gatewayUrl,
        deviceId: form.deviceId || undefined,
        ...(form.username ? { username: form.username } : {}),
        ...(form.password ? { password: form.password } : {}),
      })
    } else {
      await createSender.mutateAsync({
        label: form.label,
        side: form.side,
        gatewayUrl: form.gatewayUrl,
        username: form.username,
        password: form.password,
        deviceId: form.deviceId || undefined,
      })
    }
    setEditing(undefined)
    await refresh()
    toast.success(editing ? 'המספר השולח עודכן' : 'המספר השולח נוסף')
  }

  return (
    <Card>
      <CardHeader className='gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0'>
        <div>
          <CardTitle className='text-base'>מספרים שולחים</CardTitle>
          <p className='mt-1 text-muted-foreground text-sm'>הגדירו מספר נפרד לכל צד בחתונה.</p>
        </div>
        <Button size='sm' onClick={openCreate}>
          <Plus className='me-2 h-4 w-4' /> הוספת מספר
        </Button>
      </CardHeader>
      <CardContent>
        {sendersQuery.isLoading ? (
          <div className='grid min-h-20 place-items-center' role='status'>
            <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
          </div>
        ) : sendersQuery.data?.length ? (
          <div className='divide-y rounded-md border'>
            {sendersQuery.data.map((sender) => (
              <div
                key={sender.id}
                className='flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='font-medium'>{sender.label}</span>
                    <Badge variant='outline'>צד {sender.side}</Badge>
                    {sender.isDefault && <Badge>ברירת מחדל</Badge>}
                    {!sender.isActive && <Badge variant='secondary'>לא פעיל</Badge>}
                  </div>
                  <div className='mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-muted-foreground text-xs'>
                    <span>משתמש: {sender.usernameMasked}</span>
                    <span>סיסמה: {sender.passwordMasked}</span>
                    {sender.deviceId && <span>מכשיר: {sender.deviceId}</span>}
                    {sender.phoneMasked && <span>מספר: {sender.phoneMasked}</span>}
                  </div>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button size='sm' variant='outline' onClick={() => openEdit(sender)}>
                    <Pencil className='me-2 h-3.5 w-3.5' /> עריכה
                  </Button>
                  {!sender.isDefault && sender.isActive && (
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={busy}
                      onClick={() =>
                        void setDefault.mutateAsync({ id: sender.id }).then(async () => {
                          await refresh()
                          toast.success('ברירת המחדל עודכנה')
                        })
                      }
                    >
                      הגדר כברירת מחדל
                    </Button>
                  )}
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={busy}
                    onClick={() =>
                      void setActive
                        .mutateAsync({ id: sender.id, isActive: !sender.isActive })
                        .then(async () => {
                          await refresh()
                          toast.success(sender.isActive ? 'המספר הושבת' : 'המספר הופעל')
                        })
                    }
                  >
                    {sender.isActive ? 'השבתה' : 'הפעלה'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className='rounded-md border border-dashed p-5 text-center text-muted-foreground text-sm'>
            עדיין לא הוגדרו מספרים. עד להגדרה, השליחה תשתמש בחיבור השרת הקיים.
          </p>
        )}
      </CardContent>

      <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent dir='rtl'>
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת מספר שולח' : 'הוספת מספר שולח'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'השאירו שם משתמש או סיסמה ריקים כדי לשמור את הערכים הקיימים.'
                : 'פרטי החיבור נשמרים מוצפנים ולא יוצגו שוב במלואם.'}
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-2 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='sms-sender-label'>שם להצגה</Label>
              <Input
                id='sms-sender-label'
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                placeholder='צד חתן'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='sms-sender-side'>צד</Label>
              <Select
                value={form.side}
                onValueChange={(side: 'חתן' | 'כלה') => setForm({ ...form, side })}
              >
                <SelectTrigger id='sms-sender-side'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='חתן'>חתן</SelectItem>
                  <SelectItem value='כלה'>כלה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='sms-sender-url'>כתובת השער</Label>
              <Input
                id='sms-sender-url'
                dir='ltr'
                value={form.gatewayUrl}
                onChange={(event) => setForm({ ...form, gatewayUrl: event.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='sms-sender-username'>שם משתמש</Label>
              <Input
                id='sms-sender-username'
                dir='ltr'
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder={editing?.usernameMasked}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='sms-sender-password'>סיסמה</Label>
              <Input
                id='sms-sender-password'
                type='password'
                dir='ltr'
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder={editing?.passwordMasked}
              />
            </div>
            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='sms-sender-device'>מזהה מכשיר (אופציונלי)</Label>
              <Input
                id='sms-sender-device'
                dir='ltr'
                value={form.deviceId}
                onChange={(event) => setForm({ ...form, deviceId: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditing(undefined)}>
              ביטול
            </Button>
            <Button
              disabled={
                busy ||
                !form.label ||
                !form.gatewayUrl ||
                (!editing && (!form.username || !form.password))
              }
              onClick={() => void save()}
            >
              {busy && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
