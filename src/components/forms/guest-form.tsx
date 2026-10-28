'use client'

import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { type SubmitHandler, useFieldArray, useForm } from 'react-hook-form'
import { IoMdClose } from 'react-icons/io'
import { toast } from 'sonner'
import { getDirtyValues } from '~/app/utils/form-helpers'
import type { Event, FormInvites } from '~/app/utils/shared-types'
import { useToggleGuestForm } from '~/components/contexts/guest-form-context'
import AddFormButtons from '~/components/forms/guest/add-buttons'
import ContactForm from '~/components/forms/guest/contact-form'
import EditFormButtons from '~/components/forms/guest/edit-buttons'
import GiftSection from '~/components/forms/guest/gift-section'
import { GuestNameForm } from '~/components/forms/guest/guest-names'
import SideGroupForm from '~/components/forms/guest/side-group-form'
import {
  getDefaultHouseholdFormData,
  type HouseholdFormData,
  householdFormResolver,
} from '~/components/forms/guest-form.schema'
import { shouldShowUnsavedCloseConfirm } from '~/components/forms/guest-form.utils'
import SidePaneWrapper from '~/components/forms/wrapper'
import { SelfInviteLinkManager } from '~/components/guest-list/self-invite-link-manager'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
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
import { Label } from '~/components/ui/label'
import { api } from '~/trpc/react'

type GuestFormProps = {
  events: Event[]
  prefillFormData: HouseholdFormData | undefined
}

const collectValidationMessages = (
  fieldErrors: unknown,
  visited = new WeakSet<object>()
): string[] => {
  const messages: string[] = []

  if (!fieldErrors || typeof fieldErrors !== 'object') return messages
  if (visited.has(fieldErrors)) return messages
  visited.add(fieldErrors)
  if ('message' in fieldErrors && typeof fieldErrors.message === 'string') {
    messages.push(fieldErrors.message)
  }
  for (const [key, error] of Object.entries(fieldErrors)) {
    if (!['message', 'ref', 'types'].includes(key)) {
      messages.push(...collectValidationMessages(error, visited))
    }
  }

  return [...new Set(messages)]
}

export default function GuestForm({ events, prefillFormData }: GuestFormProps) {
  const isEditMode = !!prefillFormData
  const router = useRouter()
  const toggleGuestForm = useToggleGuestForm()
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false)
  const [showCloseConfirmation, setShowCloseConfirmation] = useState<boolean>(false)
  const [shouldCloseAfterSave, setShouldCloseAfterSave] = useState<boolean>(true)

  const form = useForm<HouseholdFormData>({
    resolver: householdFormResolver,
    defaultValues: prefillFormData ?? getDefaultHouseholdFormData(events),
    mode: 'onChange', // Real-time validation for better UX
  })

  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
    reset,
    watch,
    getValues,
    setValue,
    setError,
  } = form

  // Use field array for managing guest party
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'guestParty',
  })

  // Fetch tags for the current wedding
  const { data: tags = [] } = api.guestTag.getAll.useQuery()
  const { data: dashboardData } = api.dashboard.getForActiveWorkspace.useQuery()
  const utils = api.useUtils()

  // Mutations directly in component
  const createMutation = api.household.create.useMutation({
    onSuccess: () => {
      toast.success('המשפחה נוצרה בהצלחה!')
      reset(getDefaultHouseholdFormData(events))
      if (shouldCloseAfterSave) {
        toggleGuestForm()
      }
      void utils.dashboard.getForActiveWorkspace.invalidate()
      router.refresh()
    },
    onError: (err) => {
      const zodErrors = err.data?.zodError?.fieldErrors
      if (zodErrors) {
        // Map server errors back to form fields
        Object.entries(zodErrors).forEach(([field, messages]) => {
          if (messages?.[0]) {
            setError(field as keyof HouseholdFormData, {
              type: 'server',
              message: messages[0],
            })
          }
        })
        toast.error('אנא תקנו את שגיאות הטופס')
      } else {
        toast.error('יצירת המשפחה נכשלה. אנא נסו שוב.')
      }
    },
  })

  const updateMutation = api.household.update.useMutation({
    onSuccess: (data) => {
      toast.success('המשפחה עודכנה בהצלחה!')
      // Reset form with updated data to clear dirty state
      if (data) {
        reset(data as unknown as HouseholdFormData)
      }
      toggleGuestForm()
      void utils.dashboard.getForActiveWorkspace.invalidate()
      router.refresh()
    },
    onError: (err) => {
      const zodErrors = err.data?.zodError?.fieldErrors
      if (zodErrors) {
        Object.entries(zodErrors).forEach(([field, messages]) => {
          if (messages?.[0]) {
            setError(field as keyof HouseholdFormData, {
              type: 'server',
              message: messages[0],
            })
          }
        })
        toast.error('אנא תקנו את שגיאות הטופס')
      } else {
        toast.error('עדכון המשפחה נכשל. אנא נסו שוב.')
      }
    },
  })

  const deleteMutation = api.household.delete.useMutation({
    onSuccess: () => {
      toast.success('המשפחה נמחקה בהצלחה!')
      toggleGuestForm()
      void utils.dashboard.getForActiveWorkspace.invalidate()
      router.refresh()
    },
    onError: () => {
      toast.error('מחיקת המשפחה נכשלה. אנא נסו שוב.')
    },
  })

  const getTitle = () => {
    if (!isEditMode || !prefillFormData) return 'הוספת משפחה'
    const primaryContact = prefillFormData.guestParty.find((guest) => guest.isPrimaryContact)
    const numGuests = prefillFormData.guestParty.length
    const primaryContactName = `${primaryContact?.firstName} ${primaryContact?.lastName}`

    return numGuests > 1 ? `${primaryContactName} + ${numGuests - 1}` : primaryContactName
  }

  const handleAddGuestToParty = () => {
    const invites: FormInvites = {}
    events.forEach((event: Event) => {
      invites[event.id] = 'Not Invited'
    })

    append({
      firstName: '',
      lastName: '',
      email: null,
      phone: null,
      isPrimaryContact: false,
      ageGroup: 'ADULT' as const,
      isTagAlong: false,
      tagIds: [],
      invites,
    })
  }

  const handleRemoveGuest = (index: number) => {
    const guest = fields[index]
    if (guest && 'guestId' in guest && typeof guest.guestId === 'number') {
      // Track deleted guest in form state
      const currentDeleted = watch('deletedGuests') ?? []
      setValue('deletedGuests', [...currentDeleted, guest.guestId], {
        shouldDirty: true,
      })
    }
    remove(index)
  }

  const onSubmit: SubmitHandler<HouseholdFormData> = async (data) => {
    // Prevent submission if nothing changed in edit mode
    if (!isDirty && isEditMode) {
      toggleGuestForm()
      return
    }

    if (isEditMode) {
      // Only send changed fields for updates (but always include required fields)
      const changedData = getDirtyValues(dirtyFields, data)
      const deletedGuests = data.deletedGuests ?? []

      // Remove array fields from changedData to avoid conflict with full arrays
      delete changedData.guestParty
      delete changedData.gifts

      // Server expects these fields for update
      try {
        await updateMutation.mutateAsync({
          householdId: data.householdId, // Required
          guestParty: data.guestParty, // Always send full array
          gifts: data.gifts, // Always send full array
          ...changedData, // Add any other changed fields (address, notes, etc.)
          deletedGuests: deletedGuests.length > 0 ? deletedGuests : undefined,
        } as Parameters<typeof updateMutation.mutate>[0])
      } catch {
        // The mutation's onError callback presents the actionable Hebrew message.
      }
    } else {
      // Send all data for create
      try {
        await createMutation.mutateAsync(data)
      } catch {
        // The mutation's onError callback presents the actionable Hebrew message.
      }
    }
  }

  // Watch householdId outside conditional for React Hook rules
  const householdId = watch('householdId')

  // Combined loading state from mutations
  const isLoading = isSubmitting || createMutation.isPending || updateMutation.isPending
  const validationMessages = collectValidationMessages(errors)
  const handleRequestClose = () => {
    if (shouldShowUnsavedCloseConfirm(isDirty, isLoading)) {
      setShowCloseConfirmation(true)
      return
    }
    toggleGuestForm()
  }

  return (
    <SidePaneWrapper>
      <form className='flex h-full flex-col' onSubmit={handleSubmit(onSubmit)}>
        {/* Header */}
        <div className='flex items-center justify-between border-b bg-background p-6'>
          <h1 className='me-4 truncate font-bold text-2xl'>{getTitle()}</h1>
          <button
            type='button'
            onClick={handleRequestClose}
            aria-label='סגירת טופס אורח'
            className='text-muted-foreground transition-colors hover:text-foreground'
          >
            <IoMdClose size={24} aria-hidden='true' />
          </button>
        </div>

        {/* Invite link banner — shown only when adding a new party */}
        {!isEditMode && (
          <div className='border-b bg-muted/20 px-6 py-3'>
            <p className='mb-2 font-mono text-[0.58rem] text-foreground/55 uppercase tracking-widest'>
              או שהאורחים יוסיפו את עצמם
            </p>
            <SelfInviteLinkManager />
          </div>
        )}

        {/* Scrollable Content */}
        <div className='flex-1 overflow-y-auto pb-32'>
          {validationMessages.length > 0 && (
            <div
              role='alert'
              aria-labelledby='guest-form-error-summary-title'
              className='mx-6 mt-4 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive'
            >
              <p id='guest-form-error-summary-title' className='font-medium text-sm'>
                לא ניתן לשמור. יש לתקן את השדות הבאים:
              </p>
              <ul className='mt-2 list-inside list-disc space-y-1 text-sm'>
                {validationMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <Accordion
            type='multiple'
            defaultValue={['guests', 'contact', 'notes']}
            className='w-full'
          >
            <AccordionItem value='guests' className='border-b-0'>
              <AccordionTrigger className='px-6 py-4 font-semibold text-lg hover:no-underline'>
                משק הבית ({fields.length})
              </AccordionTrigger>
              <AccordionContent className='pb-0'>
                {fields.map((field, index) => (
                  <GuestNameForm
                    key={field.id}
                    events={events}
                    tags={tags}
                    guestIndex={index}
                    control={control}
                    register={register}
                    errors={errors}
                    handleRemoveGuest={handleRemoveGuest}
                    setValue={setValue}
                    getValues={getValues}
                  />
                ))}

                <button
                  type='button'
                  onClick={handleAddGuestToParty}
                  className='w-full border-t py-4 font-medium text-primary text-sm transition-colors hover:bg-muted/50'
                >
                  + הוספת אורח למשק הבית
                </button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='contact' className='border-b-0'>
              <AccordionTrigger className='px-6 py-4 font-semibold text-lg hover:no-underline'>
                כתובת למשלוח
              </AccordionTrigger>
              <AccordionContent className='px-6 pb-6'>
                <ContactForm register={register} errors={errors} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='sideGroup' className='border-b-0'>
              <AccordionTrigger className='px-6 py-4 font-semibold text-lg hover:no-underline'>
                שיוך / קבוצה
              </AccordionTrigger>
              <AccordionContent className='px-6 pb-6'>
                <SideGroupForm
                  watch={watch}
                  setValue={setValue}
                  households={dashboardData?.households ?? []}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='notes' className='border-b-0'>
              <AccordionTrigger className='px-6 py-4 font-semibold text-lg hover:no-underline'>
                הערות
              </AccordionTrigger>
              <AccordionContent className='px-6 pb-6'>
                <div className='space-y-2'>
                  <Label htmlFor='notes'>מידע נוסף</Label>
                  <textarea
                    id='notes'
                    {...register('notes')}
                    placeholder='הזינו הערות על האורחים שלכם, כמו אלרגיות למזון או בקשות מיוחדות'
                    className='flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                  />
                  {errors.notes && (
                    <p className='text-destructive text-sm'>{errors.notes.message}</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {isEditMode && (
              <AccordionItem value='gifts' className='border-b-0'>
                <AccordionTrigger className='px-6 py-4 font-semibold text-lg hover:no-underline'>
                  מתנות
                </AccordionTrigger>
                <AccordionContent className='px-6 pb-6'>
                  <GiftSection
                    control={control}
                    register={register}
                    errors={errors}
                    events={events}
                  />
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {isEditMode ? (
          <EditFormButtons
            isUpdatingHousehold={isLoading}
            setShowDeleteConfirmation={setShowDeleteConfirmation}
          />
        ) : (
          <AddFormButtons
            isCreatingGuests={isLoading}
            shouldCloseAfterSave={shouldCloseAfterSave}
            onSaveIntentChange={setShouldCloseAfterSave}
          />
        )}
      </form>

      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק משפחה?</AlertDialogTitle>
            <AlertDialogDescription>
              משק הבית וכל האורחים בו יימחקו לצמיתות. אי אפשר לבטל את הפעולה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                deleteMutation.mutate({ householdId })
              }}
              disabled={deleteMutation.isPending}
              className='flex items-center gap-2 bg-red-600 hover:bg-red-700'
            >
              {deleteMutation.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
              {deleteMutation.isPending ? 'מוחק...' : 'מחיקת משפחה'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCloseConfirmation} onOpenChange={setShowCloseConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>לבטל שינויים שלא נשמרו?</AlertDialogTitle>
            <AlertDialogDescription>יש שינויים שלא נשמרו. סגירה תמחק אותם.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>המשך עריכה</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                setShowCloseConfirmation(false)
                toggleGuestForm()
              }}
              disabled={isLoading}
            >
              לסגור בלי לשמור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidePaneWrapper>
  )
}
