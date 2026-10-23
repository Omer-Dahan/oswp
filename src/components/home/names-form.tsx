'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'

import { SignOutButton } from '~/components/auth-buttons'
import { LoadingSpinner } from '~/components/loaders'
import { ThemeToggle } from '~/components/theme-toggle'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Switch } from '~/components/ui/switch'
import { useSession } from '~/lib/auth-client'
import { cn } from '~/lib/utils'
import { createWeddingSchema } from '~/server/domains/wedding/wedding.validator'
import { api } from '~/trpc/react'

type NamesFormData = z.infer<typeof createWeddingSchema>

export default function NamesForm() {
  const { data: session, isPending: isLoading } = useSession()

  const createWedding = api.wedding.create.useMutation({
    onSuccess: () => {
      window.location.href = '/dashboard'
    },
  })

  const form = useForm<NamesFormData>({
    resolver: zodResolver(createWeddingSchema),
    defaultValues: {
      groomFirstName: '',
      groomMiddleName: '',
      groomLastName: '',
      brideFirstName: '',
      brideMiddleName: '',
      brideLastName: '',
      hasWeddingDetails: false,
      weddingLocation: '',
    },
  })

  // Separate state for date picker (uses Date object, converted to string on submit)
  const [weddingDate, setWeddingDate] = useState<Date | undefined>(undefined)

  const { register, handleSubmit, formState, control, watch } = form
  const { errors, isSubmitting } = formState
  const hasWeddingDetails = watch('hasWeddingDetails')

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!session) {
    return null
  }

  return (
    <main className='min-h-screen bg-background'>
      <header className='flex h-14 flex-shrink-0 items-center justify-between border-border/80 border-b bg-card/70 px-4 backdrop-blur-sm'>
        <span className='font-mono text-[0.7rem] text-foreground/60 uppercase tracking-[0.2em]'>
          OSWP
        </span>
        <div className='flex items-center gap-2'>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <div className='flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4'>
        <Card className='w-full max-w-2xl'>
          <CardHeader className='text-center'>
            <CardTitle className='font-display text-3xl italic'>תכננו את החתונה</CardTitle>
            <CardDescription>הוסיפו את השמות שלכם למטה כדי להתחיל לתכנן את היום שלכם</CardDescription>
          </CardHeader>
          <CardContent>
            {createWedding.isPending && (
              <div className='flex items-center justify-center py-4'>
                <LoadingSpinner />
              </div>
            )}
            {createWedding.isError && (
              <div className='mb-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive'>
                <p className='font-semibold'>שגיאה ביצירת החתונה</p>
                <p className='text-sm'>{createWedding.error?.message ?? 'נסו שוב'}</p>
              </div>
            )}
            <form
              onSubmit={handleSubmit((data) => {
                createWedding.mutate({
                  ...data,
                  weddingDate: weddingDate?.toISOString(), // Convert Date to string
                })
              })}
              className='space-y-8'
            >
              {/* Groom and Bride Sections */}
              <div className='grid gap-6 md:grid-cols-2'>
                {/* Groom's Section */}
                <div className='space-y-4 rounded-lg border bg-muted/50 p-6'>
                  <h3 className='font-semibold text-lg'>פרטי החתן</h3>
                  <div className='space-y-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='groomFirstName'>שם פרטי</Label>
                      <Input
                        id='groomFirstName'
                        placeholder='הזינו שם פרטי'
                        {...register('groomFirstName')}
                        disabled={isSubmitting}
                      />
                      {errors.groomFirstName && (
                        <p className='text-destructive text-sm'>{errors.groomFirstName.message}</p>
                      )}
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='groomMiddleName'>שם אמצעי (לא חובה)</Label>
                      <Input
                        id='groomMiddleName'
                        placeholder='הזינו שם אמצעי'
                        {...register('groomMiddleName')}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='groomLastName'>שם משפחה</Label>
                      <Input
                        id='groomLastName'
                        placeholder='הזינו שם משפחה'
                        {...register('groomLastName')}
                        disabled={isSubmitting}
                      />
                      {errors.groomLastName && (
                        <p className='text-destructive text-sm'>{errors.groomLastName.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bride's Section */}
                <div className='space-y-4 rounded-lg border bg-muted/50 p-6'>
                  <h3 className='font-semibold text-lg'>פרטי הכלה</h3>
                  <div className='space-y-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='brideFirstName'>שם פרטי</Label>
                      <Input
                        id='brideFirstName'
                        placeholder='הזינו שם פרטי'
                        {...register('brideFirstName')}
                        disabled={isSubmitting}
                      />
                      {errors.brideFirstName && (
                        <p className='text-destructive text-sm'>{errors.brideFirstName.message}</p>
                      )}
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='brideMiddleName'>שם אמצעי (לא חובה)</Label>
                      <Input
                        id='brideMiddleName'
                        placeholder='הזינו שם אמצעי'
                        {...register('brideMiddleName')}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='brideLastName'>שם משפחה</Label>
                      <Input
                        id='brideLastName'
                        placeholder='הזינו שם משפחה'
                        {...register('brideLastName')}
                        disabled={isSubmitting}
                      />
                      {errors.brideLastName && (
                        <p className='text-destructive text-sm'>{errors.brideLastName.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Wedding Details Toggle */}
              <div className='flex items-center justify-between rounded-lg border bg-muted/50 p-6'>
                <div className='space-y-0.5'>
                  <Label htmlFor='wedding-details-toggle' className='text-base'>
                    יש לכם תאריך ומיקום לחתונה?
                  </Label>
                  <p className='text-muted-foreground text-sm'>
                    אפשר להוסיף את המידע עכשיו או מאוחר יותר מלוח הבקרה
                  </p>
                </div>
                <Controller
                  name='hasWeddingDetails'
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id='wedding-details-toggle'
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
              </div>

              {/* Wedding Details Section (Conditional) */}
              {hasWeddingDetails && (
                <div className='space-y-4 rounded-lg border bg-muted/50 p-6'>
                  <h3 className='font-semibold text-lg'>פרטי החתונה</h3>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label>תאריך החתונה</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant='outline'
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !weddingDate && 'text-muted-foreground'
                            )}
                            disabled={isSubmitting}
                          >
                            <CalendarIcon className='mr-2 h-4 w-4' />
                            {weddingDate ? (
                              weddingDate.toLocaleDateString('he-IL', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            ) : (
                              <span>בחרו תאריך</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-auto p-0' align='start'>
                          <Calendar
                            mode='single'
                            selected={weddingDate}
                            onSelect={setWeddingDate}
                            captionLayout='dropdown'
                            startMonth={new Date()}
                            endMonth={new Date(new Date().getFullYear() + 10, 11)}
                            autoFocus
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='weddingLocation'>מיקום החתונה</Label>
                      <Input
                        id='weddingLocation'
                        placeholder='למשל: ריזורט חוף, קאבו'
                        {...register('weddingLocation')}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button type='submit' disabled={isSubmitting} className='w-full' size='lg'>
                {isSubmitting ? 'יוצרים את התוכנית…' : 'בואו נתחיל'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
