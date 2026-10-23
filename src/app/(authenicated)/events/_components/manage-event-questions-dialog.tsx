'use client'

import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EventQuestionFormDialog } from '~/app/(authenicated)/events/_components/event-question-form-dialog'
import type { Question } from '~/app/utils/shared-types'
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
import type { EventWithStats } from '~/server/domains/event/event.types'
import { api } from '~/trpc/react'

type ManageEventQuestionsDialogProps = Readonly<{
  event: EventWithStats
  open: boolean
  onOpenChange: (open: boolean) => void
}>

export function ManageEventQuestionsDialog({
  event,
  open,
  onOpenChange,
}: ManageEventQuestionsDialogProps) {
  const utils = api.useUtils()
  const [editingQuestion, setEditingQuestion] = useState<Question | undefined>(undefined)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deletingQuestion, setDeletingQuestion] = useState<Question | undefined>(undefined)

  const questions = useMemo(() => event.questions ?? [], [event.questions])

  const handleSaved = async () => {
    await utils.event.getAllByUserIdWithStats.refetch()
  }

  const deleteQuestion = api.question.delete.useMutation({
    onSuccess: async () => {
      toast.success('השאלה נמחקה')
      setDeletingQuestion(undefined)
      await utils.event.getAllByUserIdWithStats.refetch()
    },
    onError: (error) => {
      toast.error('מחיקת השאלה נכשלה', {
        description: error.message,
      })
    },
  })

  const openCreateForm = () => {
    setEditingQuestion(undefined)
    setIsFormOpen(true)
  }

  const openEditForm = (question: Question) => {
    setEditingQuestion(question)
    setIsFormOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>שאלות אישור הגעה — {event.name}</DialogTitle>
            <DialogDescription>
              נהלו שאלות ספציפיות לאירוע שאורחים רואים כשהם מאשרים הגעה לאירוע זה.
            </DialogDescription>
          </DialogHeader>

          {!event.collectRsvp ? (
            <div className='rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm'>
              הפעילו <strong>איסוף אישורי הגעה</strong> עבור אירוע זה כדי להשתמש בשאלות אישור הגעה.
            </div>
          ) : null}

          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <p className='text-muted-foreground text-sm'>
                {questions.length} {questions.length === 1 ? 'שאלה' : 'שאלות'}
              </p>
              <Button
                type='button'
                size='sm'
                onClick={openCreateForm}
                disabled={!event.collectRsvp}
              >
                <Plus className='mr-1 h-4 w-4' />
                הוסיפו שאלה
              </Button>
            </div>
            <p className='text-muted-foreground text-xs'>
              שאלות אמריקאיות יכולות לכלול באופן אופציונלי <strong>אחר</strong> תשובת כתיבה
              באישור הגעה ציבורי.
            </p>

            {questions.length === 0 ? (
              <div className='rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm'>
                אין עדיין שאלות אישור הגעה.
              </div>
            ) : (
              <ul className='space-y-2'>
                {questions.map((question) => (
                  <li
                    key={question.id}
                    className='flex items-start justify-between rounded-md border p-3 md:items-center'
                  >
                    <div>
                      <p className='font-medium text-sm'>{question.text}</p>
                      <div className='mt-1 flex flex-wrap items-center gap-2'>
                        <Badge variant='outline'>
                          {question.type === 'Option' ? 'בחירה מרובה' : 'תשובה קצרה'}
                        </Badge>
                        {question.type === 'Option' ? (
                          <>
                            <span className='text-muted-foreground text-xs'>
                              {question.options?.length ?? 0} אפשרויות
                            </span>
                            {question.allowOther ? (
                              <Badge variant='secondary'>אחר מופעל</Badge>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className='flex items-center gap-1'>
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        onClick={() => openEditForm(question)}
                        aria-label={`עריכת השאלה ${question.text}`}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        onClick={() => setDeletingQuestion(question)}
                        aria-label={`מחיקת השאלה ${question.text}`}
                      >
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => onOpenChange(false)}>
              סגרו
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventQuestionFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        eventId={event.id}
        initialQuestion={editingQuestion}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={deletingQuestion !== undefined}
        onOpenChange={(open) => !open && setDeletingQuestion(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק שאלת אישור הגעה?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את ״{deletingQuestion?.text}״ ואת כל התשובות שנאספו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteQuestion.isPending}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={deleteQuestion.isPending}
              onClick={(eventAction) => {
                eventAction.preventDefault()
                if (!deletingQuestion?.id) return
                deleteQuestion.mutate({ questionId: deletingQuestion.id })
              }}
            >
              {deleteQuestion.isPending ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
