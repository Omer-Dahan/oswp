'use client'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

type SeatingAutoSeatDialogProps = {
  open: boolean
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}

export function SeatingAutoSeatDialog(props: Readonly<SeatingAutoSeatDialogProps>) {
  const { open, isSubmitting, onOpenChange, onSubmit } = props

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='font-display text-2xl italic'>שיבוץ אוטומטי</DialogTitle>
          <DialogDescription>
            השיבוץ ממלא רק שולחנות קיימים ולא יוצר שולחנות חדשים — אורחים שלא נכנסים לשולחן קיים יישארו בחוץ.
            שיבוץ ידני לא נדרס.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
          className='space-y-4'
        >
          <DialogFooter>
            <Button type='submit' disabled={isSubmitting}>
              שבץ את כל מי שנשאר
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
