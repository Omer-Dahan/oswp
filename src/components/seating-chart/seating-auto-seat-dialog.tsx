'use client'

import { useEffect, useState } from 'react'

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
import { MAX_TABLE_CAPACITY, MIN_TABLE_CAPACITY } from '~/server/domains/seating/seating.rules'

const DEFAULT_TABLE_CAPACITY = 8

type SeatingAutoSeatDialogProps = {
  open: boolean
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (tableCapacity: number) => void
}

export function SeatingAutoSeatDialog(props: Readonly<SeatingAutoSeatDialogProps>) {
  const { open, isSubmitting, onOpenChange, onSubmit } = props
  const [tableCapacity, setTableCapacity] = useState(DEFAULT_TABLE_CAPACITY)

  useEffect(() => {
    if (open) setTableCapacity(DEFAULT_TABLE_CAPACITY)
  }, [open])

  const isValid =
    Number.isInteger(tableCapacity) &&
    tableCapacity >= MIN_TABLE_CAPACITY &&
    tableCapacity <= MAX_TABLE_CAPACITY

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='font-display text-2xl italic'>שיבוץ אוטומטי</DialogTitle>
          <DialogDescription>
            משבץ רק אורחים שעדיין לא הושבו — שיבוץ ידני לא נדרס
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (isValid) onSubmit(tableCapacity)
          }}
          noValidate
          className='space-y-4'
        >
          <div className='space-y-2'>
            <Label htmlFor='auto-seat-table-capacity'>מקומות בשולחן חדש</Label>
            <Input
              id='auto-seat-table-capacity'
              type='number'
              inputMode='numeric'
              min={MIN_TABLE_CAPACITY}
              max={MAX_TABLE_CAPACITY}
              value={tableCapacity}
              onChange={(event) => setTableCapacity(event.target.valueAsNumber)}
            />
          </div>

          <DialogFooter>
            <Button type='submit' disabled={!isValid || isSubmitting}>
              שבץ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
