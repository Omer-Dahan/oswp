'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Clock, Pencil, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { formatCurrency } from '~/components/budget/format'
import {
  SIDE_PANE_DIALOG_WIDTH_CLASS,
  SIDE_PANE_OVERLAY_CLASS,
  SIDE_PANE_SURFACE_CLASS,
} from '~/components/layout/side-pane-styles'
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
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { FileViewerDrawer, getViewableFileType } from '~/components/vendor/file-viewer-drawer'
import { QuoteForm } from '~/components/vendor/quote-form'
import { VendorCustomFields } from '~/components/vendor/vendor-custom-fields'
import type {
  EnrichedVendor,
  VendorCategoryConfig,
  VendorCustomFieldValues,
  VendorNote,
} from '~/components/vendor/vendor-enrichment-types'
import { VendorForm } from '~/components/vendor/vendor-form'
import { VendorImageGallery } from '~/components/vendor/vendor-image-gallery'
import { VendorNoteTimeline } from '~/components/vendor/vendor-note-timeline'
import { VendorStatusSelect } from '~/components/vendor/vendor-status-select'
import { uploadFiles } from '~/lib/blob'
import {
  ACCEPTED_TYPES_LABEL,
  DROPZONE_ACCEPT,
  MAX_FILE_SIZE,
  MAX_FILES_PER_QUOTE,
} from '~/lib/upload-config'
import { cn } from '~/lib/utils'
import type {
  VendorCategory,
  VendorQuote,
  VendorWithQuotes,
} from '~/server/domains/vendor/vendor.types'
import { api } from '~/trpc/react'

type VendorDetailPanelProps = {
  vendor: VendorWithQuotes | null
  currency: string
  onClose: () => void
}

type VendorApiWithEnrichment = typeof api.vendor & {
  update: {
    useMutation: (options?: { onSuccess?: () => void | Promise<void>; onError?: () => void }) => {
      mutate: (
        input: {
          vendorId: string
          contacted?: boolean
          notes?: string | null
          customFields?: VendorCustomFieldValues
        },
        options?: unknown
      ) => void
      isPending: boolean
    }
  }
  getNotes: {
    useQuery: (
      input: { vendorId: string },
      options?: { enabled?: boolean }
    ) => { data?: VendorNote[]; refetch: () => Promise<unknown> }
  }
  addNote: {
    useMutation: (options?: { onSuccess?: () => void | Promise<void>; onError?: () => void }) => {
      mutate: (input: { vendorId: string; message: string }, options?: unknown) => void
      isPending: boolean
    }
  }
  getCategoryConfig: {
    useQuery: (
      input: { category: VendorCategory },
      options?: { enabled?: boolean }
    ) => { data?: VendorCategoryConfig | null }
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})
const QUOTE_TYPE = {
  PER_GUEST: 'PER_GUEST',
} as const

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SectionLabel({
  children,
  action,
  icon,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className='mb-2.5 flex items-center gap-3'>
      <h3 className='flex shrink-0 items-center gap-1.5 font-mono text-[0.58rem] text-muted-foreground uppercase tracking-widest'>
        {icon}
        {children}
      </h3>
      <span className='h-px flex-1 bg-border' aria-hidden='true' />
      {action ? <div className='shrink-0'>{action}</div> : null}
    </div>
  )
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  return (
    <dt className='font-mono text-[0.55rem] text-muted-foreground uppercase tracking-widest'>
      {children}
    </dt>
  )
}

function QuoteFileUploader({
  quoteId,
  vendorId,
  onUploaded,
}: {
  quoteId: string
  vendorId: string
  onUploaded: () => void
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const saveFiles = api.vendor.saveQuoteFiles.useMutation()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles((prev) => {
      const combined = [...prev, ...acceptedFiles]
      if (combined.length > MAX_FILES_PER_QUOTE) {
        toast.error(`Maximum ${MAX_FILES_PER_QUOTE} files per upload`)
        return prev
      }
      return combined
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    accept: DROPZONE_ACCEPT,
    onDropRejected: (rejections) => {
      const errors = rejections[0]?.errors
      if (errors?.some((error) => error.code === 'file-too-large')) {
        toast.error('הקובץ חורג ממגבלת 8 MB')
      } else if (errors?.some((error) => error.code === 'file-invalid-type')) {
        toast.error(`Unsupported file type. Accepted: ${ACCEPTED_TYPES_LABEL}`)
      } else {
        toast.error(errors?.[0]?.message ?? 'File not accepted')
      }
    },
  })

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setIsSubmitting(true)
    setIsUploading(true)

    try {
      const uploadResults = await uploadFiles(selectedFiles)
      if (uploadResults.length > 0) {
        await saveFiles.mutateAsync({
          quoteId,
          vendorId,
          files: uploadResults.map((result) => ({
            name: result.name,
            url: result.url,
            key: result.pathname,
            size: result.size,
          })),
        })
      }
      toast.success('הקבצים הועלו')
      setSelectedFiles([])
      onUploaded()
    } catch {
      toast.error('העלאת הקבצים נכשלה')
    } finally {
      setIsSubmitting(false)
      setIsUploading(false)
    }
  }

  const busy = isSubmitting || isUploading

  return (
    <div className='mt-2 space-y-2'>
      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-md border-2 border-dashed p-3 text-center transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/40 hover:bg-muted/30'
        )}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className='font-mono text-[0.62rem] text-primary uppercase tracking-wider'>
            גררו קבצים לכאן
          </p>
        ) : (
          <div className='space-y-0.5'>
            <p className='font-mono text-[0.62rem] text-muted-foreground uppercase tracking-wider'>
              גררו ושחררו או לחצו לצירוף
            </p>
            <p className='font-mono text-[0.5rem] text-muted-foreground/70 tracking-wider'>
              {ACCEPTED_TYPES_LABEL} - max 8 MB each
            </p>
          </div>
        )}
      </div>

      {selectedFiles.length > 0 ? (
        <>
          <ul className='space-y-1'>
            {selectedFiles.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className='flex items-center justify-between rounded bg-muted px-2.5 py-1.5 font-sans text-[0.85rem]'
              >
                <span className='truncate'>{file.name}</span>
                <button
                  type='button'
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeFile(index)}
                  className='ml-2 shrink-0 text-muted-foreground hover:text-destructive'
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <Button size='sm' onClick={handleUpload} disabled={busy}>
            {busy
              ? 'Uploading...'
              : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`}
          </Button>
        </>
      ) : null}
    </div>
  )
}

export function VendorDetailPanel({ vendor, currency, onClose }: VendorDetailPanelProps) {
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [attachingQuoteId, setAttachingQuoteId] = useState<string | null>(null)
  const [viewingPdf, setViewingPdf] = useState<{ name: string; url: string } | null>(null)
  const [scratchpad, setScratchpad] = useState('')
  const [newNote, setNewNote] = useState('')
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null)
  const [deletingFile, setDeletingFile] = useState<{
    fileId: string
    quoteId: string
    name: string
  } | null>(null)
  const utils = api.useUtils()
  const vendorApi = api.vendor as VendorApiWithEnrichment

  const { data: vendorData, refetch } = api.vendor.getById.useQuery(
    { vendorId: vendor?.id ?? '' },
    { enabled: !!vendor?.id, initialData: vendor ?? undefined }
  )
  const enrichedVendor = vendorData as EnrichedVendor | undefined

  const { data: noteTimeline = [], refetch: refetchNotes } = vendorApi.getNotes.useQuery(
    { vendorId: vendor?.id ?? '' },
    { enabled: !!vendor?.id }
  )
  const { data: categoryConfig } = vendorApi.getCategoryConfig.useQuery(
    { category: (enrichedVendor?.category ?? vendor?.category ?? 'OTHER') as VendorCategory },
    { enabled: !!enrichedVendor?.category }
  )

  const updateStatus = api.vendor.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([refetch(), utils.vendor.getAll.invalidate()])
    },
    onError: () => toast.error('עדכון הסטטוס נכשל'),
  })

  const updateVendor = vendorApi.update.useMutation({
    onError: () => toast.error('עדכון הספק נכשל'),
  })

  const addNote = vendorApi.addNote.useMutation({
    onError: () => toast.error('הוספת ההערה נכשלה'),
  })

  const deleteQuote = api.vendor.deleteQuote.useMutation({
    onSuccess: async () => {
      setDeletingQuoteId(null)
      await refetch()
      toast.success('הצעת המחיר הוסרה')
    },
    onError: () => toast.error('מחיקת הצעת המחיר נכשלה'),
  })

  const deleteFile = api.vendor.deleteQuoteFile.useMutation({
    onSuccess: async () => {
      setDeletingFile(null)
      await refetch()
      toast.success('הקובץ הוסר')
    },
    onError: () => toast.error('מחיקת הקובץ נכשלה'),
  })
  const setRating = api.vendor.setRating.useMutation({
    onSuccess: async () => {
      await Promise.all([refetch(), utils.vendor.getAll.invalidate()])
      toast.success('הדירוג עודכן')
    },
    onError: () => toast.error('שמירת הדירוג נכשלה'),
  })

  useEffect(() => {
    setScratchpad(enrichedVendor?.notes ?? '')
  }, [enrichedVendor?.notes])

  if (!vendor || !vendorData || !enrichedVendor) {
    return (
      <>
        <Dialog open={false} onOpenChange={(open) => !open && onClose()} />
        <FileViewerDrawer file={null} onClose={() => setViewingPdf(null)} />
      </>
    )
  }

  const formatPrice = (price: number) => formatCurrency(price, currency)
  const formatDate = (date: Date | string) => dateFormatter.format(new Date(date))

  const persistVendorUpdate = (
    input: {
      vendorId: string
      contacted?: boolean
      notes?: string | null
      customFields?: VendorCustomFieldValues
    },
    successMessage: string
  ) => {
    updateVendor.mutate(input, {
      onSuccess: async () => {
        await Promise.all([refetch(), utils.vendor.getAll.invalidate()])
        toast.success(successMessage)
      },
    })
  }

  const handleSaveScratchpad = () => {
    const normalized = scratchpad.trim()
    persistVendorUpdate(
      {
        vendorId: enrichedVendor.id,
        notes: normalized ? scratchpad : null,
      },
      'Scratchpad saved'
    )
  }

  const handleAddNote = () => {
    const normalized = newNote.trim()
    if (!normalized) return

    addNote.mutate(
      {
        vendorId: enrichedVendor.id,
        message: normalized,
      },
      {
        onSuccess: async () => {
          setNewNote('')
          await Promise.all([refetchNotes(), refetch(), utils.vendor.getAll.invalidate()])
          toast.success('ההערה נוספה')
        },
      }
    )
  }

  const handleCustomFieldSave = (customFields: VendorCustomFieldValues) => {
    persistVendorUpdate(
      {
        vendorId: enrichedVendor.id,
        customFields,
      },
      'Custom fields saved'
    )
  }

  return (
    <>
      <Dialog open={!!vendor} onOpenChange={(open) => !open && onClose()}>
        <DialogPortal>
          <DialogOverlay className={SIDE_PANE_OVERLAY_CLASS} />
          <DialogPrimitive.Content
            className={cn(
              `fixed inset-0 z-50 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden p-0 pb-0 outline-none ${SIDE_PANE_SURFACE_CLASS}`,
              `md:inset-y-0 md:right-0 md:left-auto md:h-full md:translate-x-0 md:translate-y-0 md:p-6 ${SIDE_PANE_DIALOG_WIDTH_CLASS}`
            )}
          >
            <DialogClose
              aria-label='סגירת פרטי הספק'
              className='absolute top-4 right-4 z-10 rounded-full border border-border/80 bg-card p-1.5 opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            >
              <X className='h-4 w-4' aria-hidden='true' />
            </DialogClose>

            <header className='border-border/80 border-b px-5 py-5 pr-14 md:px-6'>
              <DialogTitle className='font-display text-2xl text-foreground italic leading-tight'>
                {enrichedVendor.name}
              </DialogTitle>
              <DialogDescription className='sr-only'>פאנל פרטי ספק</DialogDescription>
              <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-2'>
                <VendorStatusSelect
                  value={enrichedVendor.status}
                  onChange={(status) =>
                    updateStatus.mutate({ vendorId: enrichedVendor.id, status })
                  }
                  disabled={updateStatus.isPending}
                />
                <div className='flex shrink-0 items-center gap-2'>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type='button'
                      className='text-base leading-none'
                      aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      onClick={() => setRating.mutate({ vendorId: vendorData.id, stars: star })}
                      disabled={setRating.isPending}
                    >
                      {star <= (vendorData.ratingSummary.currentUserRating ?? 0) ? '★' : '☆'}
                    </button>
                  ))}
                  {vendorData.ratingSummary.currentUserRating === null && (
                    <span className='font-mono text-[0.58rem] text-muted-foreground uppercase tracking-wider'>
                      ללא דירוג
                    </span>
                  )}
                </div>
                <div className='flex items-center gap-2'>
                  <Label
                    htmlFor='vendor-contacted'
                    className='font-mono text-[0.58rem] text-muted-foreground uppercase tracking-wider'
                  >
                    נוצר קשר
                  </Label>
                  <Switch
                    id='vendor-contacted'
                    aria-label='סימון הספק כנוצר קשר'
                    checked={enrichedVendor.contacted === true}
                    onCheckedChange={(checked) =>
                      persistVendorUpdate(
                        {
                          vendorId: enrichedVendor.id,
                          contacted: checked,
                        },
                        checked ? 'Marked as contacted' : 'Marked as not contacted'
                      )
                    }
                    disabled={updateVendor.isPending}
                  />
                </div>
              </div>
            </header>

            <div className='flex min-h-0 flex-1 flex-col'>
              <div className='flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 pb-20 md:px-6 md:pb-20'>
                {showEditForm ? (
                  <VendorForm
                    mode='edit'
                    vendor={enrichedVendor}
                    onSuccess={async () => {
                      await Promise.all([refetch(), utils.vendor.getAll.invalidate()])
                      setShowEditForm(false)
                    }}
                    onCancel={() => setShowEditForm(false)}
                  />
                ) : (
                  <div className='space-y-5'>
                    <section>
                      <SectionLabel>תמונות</SectionLabel>
                      <VendorImageGallery
                        images={enrichedVendor.images ?? []}
                        vendorId={enrichedVendor.id}
                        hasWebsite={!!enrichedVendor.website}
                      />
                    </section>

                    <section>
                      <SectionLabel
                        action={
                          <button
                            type='button'
                            onClick={() => setShowEditForm(true)}
                            className='font-mono text-[0.58rem] text-primary uppercase tracking-wider hover:underline'
                          >
                            עריכה
                          </button>
                        }
                      >
                        פרטים
                      </SectionLabel>
                      <dl className='grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2'>
                        {enrichedVendor.location ? (
                          <div>
                            <DetailLabel>מיקום</DetailLabel>
                            <dd className='font-sans text-[0.92rem] text-foreground'>
                              {enrichedVendor.location}
                            </dd>
                          </div>
                        ) : null}
                        {enrichedVendor.website ? (
                          <div>
                            <DetailLabel>אתר</DetailLabel>
                            <dd>
                              <a
                                href={enrichedVendor.website}
                                target='_blank'
                                rel='noreferrer'
                                className='truncate font-sans text-[0.92rem] text-primary hover:underline'
                              >
                                {enrichedVendor.website}
                              </a>
                            </dd>
                          </div>
                        ) : null}
                        {enrichedVendor.instagram ? (
                          <div>
                            <DetailLabel>אינסטגרם</DetailLabel>
                            <dd className='font-sans text-[0.92rem] text-foreground'>
                              {enrichedVendor.instagram}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </section>

                    {enrichedVendor.contactName ||
                    enrichedVendor.contactEmail ||
                    enrichedVendor.contactPhone ? (
                      <section>
                        <SectionLabel>יצירת קשר</SectionLabel>
                        <dl className='grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2'>
                          {enrichedVendor.contactName ? (
                            <div>
                              <DetailLabel>שם</DetailLabel>
                              <dd className='font-sans text-[0.92rem] text-foreground'>
                                {enrichedVendor.contactName}
                              </dd>
                            </div>
                          ) : null}
                          {enrichedVendor.contactEmail ? (
                            <div>
                              <DetailLabel>דוא״ל</DetailLabel>
                              <dd>
                                <a
                                  href={`mailto:${enrichedVendor.contactEmail}`}
                                  className='font-sans text-[0.92rem] text-primary hover:underline'
                                >
                                  {enrichedVendor.contactEmail}
                                </a>
                              </dd>
                            </div>
                          ) : null}
                          {enrichedVendor.contactPhone ? (
                            <div>
                              <DetailLabel>טלפון</DetailLabel>
                              <dd className='font-sans text-[0.92rem] text-foreground'>
                                {enrichedVendor.contactPhone}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </section>
                    ) : null}

                    <section>
                      <SectionLabel icon={<Pencil className='h-3 w-3' />}>פנקס רשימות</SectionLabel>
                      <div className='rounded-md bg-amber-50/50 p-3 dark:bg-amber-950/10 space-y-3'>
                        <Textarea
                          id='vendor-scratchpad'
                          aria-label='הערות פנקס'
                          value={scratchpad}
                          onChange={(event) => setScratchpad(event.target.value)}
                          className='min-h-28 font-serif'
                          placeholder='תעדו רשמים, אילוצים ותזכורות.'
                        />
                        <Button
                          type='button'
                          variant='outline'
                          onClick={handleSaveScratchpad}
                          disabled={updateVendor.isPending}
                        >
                          {updateVendor.isPending ? 'Saving...' : 'Save Scratchpad'}
                        </Button>
                      </div>
                    </section>

                    <section>
                      <SectionLabel icon={<Clock className='h-3 w-3' />}>
                        יומן אינטראקציות
                      </SectionLabel>
                      <div className='space-y-3'>
                        <div className='flex gap-2'>
                          <Input
                            id='vendor-note-composer'
                            aria-label='הוספת הערת אינטראקציה'
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder='תעדו פניות, מעקבים והחלטות.'
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newNote.trim()) handleAddNote()
                            }}
                            className='flex-1'
                          />
                          <Button
                            type='button'
                            onClick={handleAddNote}
                            disabled={addNote.isPending || newNote.trim().length === 0}
                          >
                            {addNote.isPending ? 'Adding...' : 'Add'}
                          </Button>
                        </div>
                        <VendorNoteTimeline notes={noteTimeline} />
                      </div>
                    </section>

                    <section>
                      <SectionLabel>שדות מותאמים</SectionLabel>
                      <VendorCustomFields
                        definitions={categoryConfig?.fieldDefinitions ?? []}
                        values={enrichedVendor.customFields}
                        onSave={handleCustomFieldSave}
                        isSaving={updateVendor.isPending}
                      />
                    </section>

                    <section>
                      <SectionLabel
                        action={
                          !showQuoteForm ? (
                            <button
                              type='button'
                              onClick={() => setShowQuoteForm(true)}
                              className='font-mono text-[0.58rem] text-primary uppercase tracking-wider hover:underline'
                            >
                              + Add Quote
                            </button>
                          ) : null
                        }
                      >
                        Quotes
                        {enrichedVendor.quotes.length > 0
                          ? ` (${enrichedVendor.quotes.length})`
                          : ''}
                      </SectionLabel>

                      {showQuoteForm ? (
                        <div className='mb-3'>
                          <QuoteForm
                            vendorId={enrichedVendor.id}
                            onSuccess={async () => {
                              await refetch()
                              setShowQuoteForm(false)
                            }}
                            onCancel={() => setShowQuoteForm(false)}
                          />
                        </div>
                      ) : null}

                      {enrichedVendor.quotes.length === 0 && !showQuoteForm ? (
                        <p className='font-mono text-[0.72rem] text-muted-foreground uppercase tracking-wider'>
                          אין הצעות מחיר עדיין
                        </p>
                      ) : null}

                      {enrichedVendor.quotes.length > 0 ? (
                        <div className='space-y-2'>
                          {enrichedVendor.quotes.map((quote: VendorQuote) => (
                            <div
                              key={quote.id}
                              className='rounded-lg border border-border/90 bg-card/60 px-4 py-3'
                            >
                              {editingQuoteId === quote.id ? (
                                <QuoteForm
                                  vendorId={enrichedVendor.id}
                                  mode='edit'
                                  quote={quote}
                                  onSuccess={async () => {
                                    await refetch()
                                    setEditingQuoteId(null)
                                  }}
                                  onCancel={() => setEditingQuoteId(null)}
                                />
                              ) : (
                                <>
                                  <div className='flex items-start justify-between'>
                                    <div>
                                      <div className='flex items-baseline gap-2'>
                                        <p className='font-display text-foreground text-xl italic'>
                                          {formatPrice(quote.price)}
                                        </p>
                                        <span className='font-mono text-[0.55rem] text-muted-foreground uppercase tracking-wider'>
                                          {quote.quoteType === QUOTE_TYPE.PER_GUEST
                                            ? '/ guest'
                                            : 'flat fee'}
                                        </span>
                                      </div>
                                      <p className='font-mono text-[0.55rem] text-muted-foreground lowercase tracking-wider'>
                                        {formatDate(quote.quoteDate)}
                                      </p>
                                      {quote.notes ? (
                                        <p className='mt-1.5 font-sans text-[0.88rem] text-foreground/75 leading-relaxed'>
                                          {quote.notes}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className='ml-4 flex items-center gap-2'>
                                      <button
                                        type='button'
                                        className='font-mono text-[0.58rem] text-muted-foreground uppercase tracking-wider hover:text-primary'
                                        onClick={() => setEditingQuoteId(quote.id)}
                                      >
                                        עריכה
                                      </button>
                                      <button
                                        type='button'
                                        className='font-mono text-[0.58rem] text-destructive/70 uppercase tracking-wider hover:text-destructive'
                                        onClick={() => setDeletingQuoteId(quote.id)}
                                        disabled={deleteQuote.isPending}
                                      >
                                        הסרה
                                      </button>
                                    </div>
                                  </div>

                                  {quote.files.length > 0 ? (
                                    <div className='mt-2.5 space-y-1'>
                                      {quote.files.map((file) => {
                                        const viewableType = getViewableFileType(file.name)

                                        return (
                                          <div
                                            key={file.id}
                                            className='flex items-center gap-2 rounded bg-muted px-2.5 py-1.5'
                                          >
                                            {viewableType ? (
                                              <button
                                                type='button'
                                                onClick={() =>
                                                  setViewingPdf({ name: file.name, url: file.url })
                                                }
                                                className='min-w-0 flex-1 truncate text-left font-sans text-[0.85rem] text-primary hover:underline'
                                              >
                                                {file.name}
                                              </button>
                                            ) : (
                                              <a
                                                href={file.url}
                                                target='_blank'
                                                rel='noreferrer'
                                                className='min-w-0 flex-1 truncate font-sans text-[0.85rem] text-primary hover:underline'
                                              >
                                                {file.name}
                                              </a>
                                            )}
                                            <span className='shrink-0 font-mono text-[0.55rem] text-muted-foreground lowercase tracking-wider'>
                                              {formatFileSize(file.size)}
                                            </span>
                                            <button
                                              type='button'
                                              aria-label={`Remove ${file.name}`}
                                              onClick={() =>
                                                setDeletingFile({
                                                  fileId: file.id,
                                                  quoteId: quote.id,
                                                  name: file.name,
                                                })
                                              }
                                              disabled={deleteFile.isPending}
                                              className='shrink-0 text-muted-foreground hover:text-destructive'
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : null}

                                  {attachingQuoteId === quote.id ? (
                                    <QuoteFileUploader
                                      quoteId={quote.id}
                                      vendorId={enrichedVendor.id}
                                      onUploaded={async () => {
                                        await refetch()
                                        setAttachingQuoteId(null)
                                      }}
                                    />
                                  ) : (
                                    <button
                                      type='button'
                                      className='mt-2.5 rounded-md border border-primary/30 border-dashed px-2.5 py-1.5 font-mono text-[0.58rem] text-primary uppercase tracking-wider transition-colors hover:border-primary hover:bg-primary/5'
                                      onClick={() => setAttachingQuoteId(quote.id)}
                                    >
                                      + Attach files
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  </div>
                )}
              </div>

              <footer className='flex gap-3 border-border/80 border-t px-5 py-4 md:px-6'>
                <Button variant='outline' className='flex-1' onClick={onClose}>
                  סגרו
                </Button>
              </footer>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <FileViewerDrawer file={viewingPdf} onClose={() => setViewingPdf(null)} />

      <AlertDialog
        open={!!deletingQuoteId}
        onOpenChange={(open) => !open && setDeletingQuoteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>להסיר את הצעת המחיר?</AlertDialogTitle>
            <AlertDialogDescription>
              הפעולה תסיר לצמיתות את הצעת המחיר ואת כל הקבצים המצורפים אליה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteQuote.isPending}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deletingQuoteId) {
                  deleteQuote.mutate({ quoteId: deletingQuoteId, vendorId: enrichedVendor.id })
                }
              }}
              disabled={deleteQuote.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteQuote.isPending ? 'Removing…' : 'Remove quote'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>להסיר את הקובץ?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deletingFile?.name}&rdquo; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFile.isPending}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deletingFile) {
                  deleteFile.mutate({
                    fileId: deletingFile.fileId,
                    quoteId: deletingFile.quoteId,
                    vendorId: enrichedVendor.id,
                  })
                }
              }}
              disabled={deleteFile.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteFile.isPending ? 'Removing…' : 'Remove file'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
