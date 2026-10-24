'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { saveAccountSchema } from '~/server/domains/whatsapp/whatsapp.validator'
import { api } from '~/trpc/react'

type WhatsappFormData = z.infer<typeof saveAccountSchema>

export function WhatsappConnectionCard() {
  const utils = api.useUtils()

  const account = api.whatsapp.getAccount.useQuery()

  const saveAccount = api.whatsapp.saveAccount.useMutation({
    onSuccess: () => {
      toast.success('פרטי החיבור ל-WhatsApp נשמרו')
      void utils.whatsapp.getAccount.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'שמירת פרטי החיבור נכשלה')
    },
  })

  const testConnection = api.whatsapp.testConnection.useMutation({
    onSuccess: () => {
      void utils.whatsapp.getAccount.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'בדיקת החיבור נכשלה')
    },
  })

  const form = useForm<WhatsappFormData>({
    resolver: zodResolver(saveAccountSchema),
    defaultValues: {
      phoneNumberId: account.data?.phoneNumberId ?? '',
      wabaId: account.data?.wabaId ?? '',
      accessToken: '',
      verifyToken: '',
      appSecret: '',
    },
    values: account.data
      ? {
          phoneNumberId: account.data.phoneNumberId ?? '',
          wabaId: account.data.wabaId ?? '',
          accessToken: '',
          verifyToken: '',
          appSecret: '',
        }
      : undefined,
  })

  const { register, handleSubmit, formState } = form
  const { errors, isSubmitting } = formState

  const status = account.data?.status ?? 'UNCONFIGURED'
  const tokenPlaceholder = account.data?.accessTokenMasked ?? 'הדביקו את ה-Access Token'
  const appSecretPlaceholder = account.data?.appSecretMasked ?? 'הדביקו את ה-App Secret'

  return (
    <div className='space-y-4 rounded-lg border border-border p-4'>
      <div>
        <h4 className='font-medium text-foreground'>חיבור לוואטסאפ</h4>
        <p className='mt-1 text-muted-foreground text-xs'>
          חברו את חשבון ה-WhatsApp Business כדי לשלוח הזמנות ותזכורות לאורחים
        </p>
      </div>

      {account.isLoading ? (
        <p className='text-muted-foreground text-xs'>טוען…</p>
      ) : (
        <>
          <StatusLine
            status={status}
            verifiedName={account.data?.verifiedName ?? null}
            displayPhoneNumber={account.data?.displayPhoneNumber ?? null}
            lastCheckedAt={account.data?.lastCheckedAt ?? null}
            lastError={account.data?.lastError ?? null}
          />

          <form
            onSubmit={handleSubmit((data) => {
              saveAccount.mutate(data)
            })}
            className='space-y-3'
          >
            <div className='space-y-2'>
              <Label htmlFor='wa-phoneNumberId'>מזהה מספר טלפון (Phone Number ID)</Label>
              <Input
                id='wa-phoneNumberId'
                dir='ltr'
                className='text-left font-mono'
                placeholder='הזינו את Phone Number ID'
                {...register('phoneNumberId')}
                disabled={isSubmitting}
              />
              {errors.phoneNumberId && (
                <p className='text-destructive text-sm'>{errors.phoneNumberId.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='wa-wabaId'>WABA ID</Label>
              <Input
                id='wa-wabaId'
                dir='ltr'
                className='text-left font-mono'
                placeholder='הזינו את WABA ID'
                {...register('wabaId')}
                disabled={isSubmitting}
              />
              {errors.wabaId && <p className='text-destructive text-sm'>{errors.wabaId.message}</p>}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='wa-accessToken'>טוקן גישה</Label>
              <Input
                id='wa-accessToken'
                type='password'
                dir='ltr'
                className='text-left font-mono'
                placeholder={tokenPlaceholder}
                {...register('accessToken')}
                disabled={isSubmitting}
              />
              {errors.accessToken && (
                <p className='text-destructive text-sm'>{errors.accessToken.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='wa-verifyToken'>טוקן אימות</Label>
              <Input
                id='wa-verifyToken'
                type='password'
                dir='ltr'
                className='text-left font-mono'
                placeholder='בחרו מחרוזת אימות לרישום ה-webhook'
                {...register('verifyToken')}
                disabled={isSubmitting}
              />
              {errors.verifyToken && (
                <p className='text-destructive text-sm'>{errors.verifyToken.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='wa-appSecret'>App Secret (סוד האפליקציה)</Label>
              <Input
                id='wa-appSecret'
                type='password'
                dir='ltr'
                className='text-left font-mono'
                placeholder={appSecretPlaceholder}
                {...register('appSecret')}
                disabled={isSubmitting}
              />
              {errors.appSecret && (
                <p className='text-destructive text-sm'>{errors.appSecret.message}</p>
              )}
            </div>

            <div className='flex gap-2'>
              <Button type='submit' size='sm' disabled={isSubmitting || saveAccount.isPending}>
                שמירה
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => testConnection.mutate()}
                disabled={!account.data?.configured || testConnection.isPending}
              >
                בדיקת חיבור
              </Button>
            </div>
          </form>

          <Accordion type='single' collapsible>
            <AccordionItem value='help' className='border-none'>
              <AccordionTrigger className='py-2 text-muted-foreground text-xs hover:no-underline'>
                איפה מוצאים את הפרטים האלה?
              </AccordionTrigger>
              <AccordionContent className='text-muted-foreground text-xs'>
                <ul className='list-inside list-disc space-y-1'>
                  <li>
                    את Phone Number ID ואת WABA ID מוצאים בלוח הבקרה של Meta, בתפריט WhatsApp
                    ← API Setup.
                  </li>
                  <li>
                    ה-Access Token צריך להיות System User Token קבוע (לא טוקן הבדיקה שתקף ל-24
                    שעות).
                  </li>
                  <li>
                    ה-Verify Token הוא מחרוזת שאתם בוחרים בעצמכם בעת רישום ה-webhook ב-Meta.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  )
}

function StatusLine({
  status,
  verifiedName,
  displayPhoneNumber,
  lastCheckedAt,
  lastError,
}: {
  status: 'ACTIVE' | 'ERROR' | 'UNCONFIGURED'
  verifiedName: string | null
  displayPhoneNumber: string | null
  lastCheckedAt: Date | null
  lastError: string | null
}) {
  if (status === 'ACTIVE') {
    return (
      <div className='rounded-md border border-green-600/30 bg-green-600/10 p-3 text-xs'>
        <p className='font-medium text-green-700'>
          מחובר{verifiedName ? ` · ${verifiedName}` : ''}
          {displayPhoneNumber ? ` · ${displayPhoneNumber}` : ''}
        </p>
        {lastCheckedAt && (
          <p className='mt-1 text-green-700/70'>
            נבדק לאחרונה ב-{new Date(lastCheckedAt).toLocaleString('he-IL')}
          </p>
        )}
      </div>
    )
  }

  if (status === 'ERROR') {
    return (
      <div className='rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs'>
        <p className='font-medium text-destructive'>החיבור נכשל</p>
        {lastError && <p className='mt-1 text-destructive/80'>{lastError}</p>}
      </div>
    )
  }

  return (
    <div className='rounded-md border border-border/50 bg-muted/20 p-3 text-xs'>
      <p className='text-muted-foreground'>טרם הוגדר חיבור</p>
    </div>
  )
}
