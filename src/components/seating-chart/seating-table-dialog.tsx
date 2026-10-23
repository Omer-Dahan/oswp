'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

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
import { Label } from '~/components/ui/label'
import { zodFormResolver } from '~/lib/forms/zod-form-resolver'
import { cn } from '~/lib/utils'
import { MAX_TABLE_CAPACITY, MIN_TABLE_CAPACITY } from '~/server/domains/seating/seating.rules'
import {
  seatingTableShapeSchema,
  tableNameSchema,
} from '~/server/domains/seating/seating.validator'

const seatingTableFormSchema = z.object({
  name: tableNameSchema,
  shape: seatingTableShapeSchema,
  // Same bounds as the server, with wording for the form field
  capacity: z
    .number({ error: 'הזינו כמה מקומות יש בשולחן הזה' })
    .int('מספר המקומות חייב להיות מספר שלם')
    .min(MIN_TABLE_CAPACITY, `נדרש לפחות ${MIN_TABLE_CAPACITY} מקום`)
    .max(MAX_TABLE_CAPACITY, `לכל היותר ${MAX_TABLE_CAPACITY} מקומות`),
})

export type SeatingTableFormValues = z.infer<typeof seatingTableFormSchema>

type SeatingTableDialogProps = {
  mode: 'create' | 'edit'
  open: boolean
  defaultValues: SeatingTableFormValues
  minCapacity?: number
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  // `changed` holds only the fields edited since the dialog opened, so an edit
  // never resends values another planner may have changed in the meantime
  onSubmit: (values: SeatingTableFormValues, changed: Partial<SeatingTableFormValues>) => void
  onDelete?: () => void
  onCloseAutoFocus?: (event: Event) => void
}

const SHAPE_OPTIONS = [
  { value: 'ROUND', label: 'עגול' },
  { value: 'RECTANGULAR', label: 'מלבני' },
] as const

export function SeatingTableDialog(props: Readonly<SeatingTableDialogProps>) {
  const {
    mode,
    open,
    defaultValues,
    minCapacity = 0,
    isSubmitting,
    onOpenChange,
    onSubmit,
    onDelete,
    onCloseAutoFocus,
  } = props

  const {
    formState: { errors, dirtyFields },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<SeatingTableFormValues>({
    resolver: zodFormResolver(seatingTableFormSchema),
    defaultValues,
  })
  const selectedShape = watch('shape')

  // Load values only when the dialog opens, so data changing underneath an
  // open dialog (optimistic update, rollback, refetch) never wipes user input
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) reset(defaultValues)
    wasOpen.current = open
  }, [open, defaultValues, reset])

  const submit = handleSubmit((values) => {
    const changed: Partial<SeatingTableFormValues> = {
      ...(dirtyFields.name ? { name: values.name } : {}),
      ...(dirtyFields.shape ? { shape: values.shape } : {}),
      ...(dirtyFields.capacity ? { capacity: values.capacity } : {}),
    }
    // Only a seat count the planner changed is checked against who is seated now
    if (changed.capacity !== undefined && changed.capacity < minCapacity) {
      setError('capacity', {
        message: `${minCapacity} אורחים יושבים כאן. העבירו אורחים לפני הקטנת מספר המקומות.`,
      })
      return
    }
    onSubmit(values, changed)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md' onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className='font-display text-2xl italic'>
            {mode === 'create' ? 'הוסיפו שולחן' : 'עריכת שולחן'}
          </DialogTitle>
          <DialogDescription>בחרו צורה וכמה אורחים היא מכילה.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='seating-table-name'>שם השולחן</Label>
            <Input id='seating-table-name' placeholder='למשל, שולחן ראשי' {...register('name')} />
            {errors.name ? <p className='text-destructive text-sm'>{errors.name.message}</p> : null}
          </div>

          <fieldset className='space-y-2'>
            <legend className='font-medium text-sm leading-none'>צורה</legend>
            <div className='grid grid-cols-2 gap-2'>
              {SHAPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-[4px] border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    selectedShape === option.value
                      ? 'border-foreground bg-foreground/[0.04]'
                      : 'border-input hover:bg-muted'
                  )}
                >
                  <input
                    type='radio'
                    value={option.value}
                    className='sr-only'
                    {...register('shape')}
                  />
                  <span
                    aria-hidden='true'
                    className={cn(
                      'inline-block border-2 border-current',
                      option.value === 'ROUND' ? 'h-5 w-5 rounded-full' : 'h-4 w-7 rounded-[2px]'
                    )}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className='space-y-2'>
            <Label htmlFor='seating-table-capacity'>מקומות</Label>
            <Input
              id='seating-table-capacity'
              type='number'
              inputMode='numeric'
              min={Math.max(MIN_TABLE_CAPACITY, minCapacity)}
              max={MAX_TABLE_CAPACITY}
              {...register('capacity', { valueAsNumber: true })}
            />
            {errors.capacity ? (
              <p className='text-destructive text-sm'>{errors.capacity.message}</p>
            ) : null}
          </div>

          <DialogFooter className='gap-2 sm:justify-between'>
            {mode === 'edit' && onDelete ? (
              <Button type='button' variant='ghost' className='text-destructive' onClick={onDelete}>
                מחקו שולחן
              </Button>
            ) : (
              <span />
            )}
            <Button type='submit' disabled={isSubmitting}>
              {mode === 'create' ? 'הוסיפו שולחן' : 'שמירה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
