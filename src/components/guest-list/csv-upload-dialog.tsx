'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Event } from '~/app/utils/shared-types'
import {
  downloadGuestCsvTemplate,
  type GuestCsvRowOutput,
  type ParsedCsvRow,
  parseSpreadsheetFile,
} from '~/components/guest-list/guest-csv-import.schema'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FileDropzone } from '~/components/ui/file-dropzone'
import { api } from '~/trpc/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'upload' | 'preview'

type ValidRow = ParsedCsvRow & { valid: true; data: GuestCsvRowOutput }

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type PreviewTableProps = { rows: ParsedCsvRow[] }

const PREVIEW_HEADERS = [
  '#',
  'הזמנה לכבוד (שם פרטי, שם משפחה)',
  'מס׳ אורחים',
  'צד',
  'קבוצה',
  'סלולרי',
  'טלפון רגיל',
  'אימייל',
  'עיר',
  'רחוב',
  'מיקוד',
  'תא דואר',
  'צ׳ק צפוי',
  'קבוצת גיל',
  'סטטוס',
]

function cell(value: string | number | undefined | null): string {
  return value === undefined || value === null || value === '' ? '—' : String(value)
}

function PreviewTable({ rows }: PreviewTableProps) {
  return (
    <div className='max-h-80 overflow-auto rounded-md border'>
      <table className='w-full text-sm'>
        <thead className='sticky top-0 bg-muted'>
          <tr>
            {PREVIEW_HEADERS.map((h) => (
              <th key={h} className='px-3 py-2 text-start font-medium text-muted-foreground'>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.rowNumber}
              className={
                row.valid ? 'border-border border-t' : 'border-border border-t bg-destructive/5'
              }
            >
              <td className='px-3 py-2 text-muted-foreground'>{row.rowNumber}</td>
              <td className='px-3 py-2'>
                {cell([row.raw.firstName, row.raw.lastName].filter(Boolean).join(' '))}
              </td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.invitedCount)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.side)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.groupName)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.phone)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.phoneAlt)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.email)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.city)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.address1)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.zipCode)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.address2)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.expectedCheck)}</td>
              <td className='px-3 py-2 text-muted-foreground'>{cell(row.raw.ageGroup)}</td>
              <td className='px-3 py-2'>
                {row.valid ? (
                  <span className='font-medium text-success text-xs'>תקין</span>
                ) : (
                  <span className='font-medium text-destructive text-xs'>
                    {row.errors.join('; ')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

type CsvUploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: Event[]
}

export function CsvUploadDialog({ open, onOpenChange, events }: CsvUploadDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([])
  const [fileName, setFileName] = useState('')
  const [isParsing, setIsParsing] = useState(false)

  const validRows = parsedRows.filter((r): r is ValidRow => r.valid)
  const invalidCount = parsedRows.length - validRows.length

  // Reset dialog state when it closes
  useEffect(() => {
    if (!open) {
      setStep('upload')
      setParsedRows([])
      setFileName('')
      setIsParsing(false)
    }
  }, [open])

  const bulkCreateMutation = api.household.bulkCreate.useMutation({
    onSuccess: ({ created, failed }) => {
      if (failed > 0) {
        toast.warning(
          `הייבוא הושלם: ${created} ${created === 1 ? 'אורח' : 'אורחים'}, ${failed} דולגו בגלל שגיאות.`
        )
      } else {
        toast.success(`${created} ${created === 1 ? 'אורח יובא' : 'אורחים יובאו'} בהצלחה!`)
      }
      router.refresh()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'ייבוא האורחים נכשל. נסו שוב.')
    },
  })

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setIsParsing(true)
    try {
      const rows = await parseSpreadsheetFile(file)
      setParsedRows(rows)
      setStep('preview')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'קריאת הקובץ נכשלה'
      toast.error(message)
    } finally {
      setIsParsing(false)
    }
  }, [])

  const handleImport = () => {
    if (validRows.length === 0) return
    const invites = Object.fromEntries(events.map((e) => [e.id, 'Not Invited']))
    const households = validRows.map(({ data }) => ({
      address1: data.address1,
      address2: data.address2,
      city: data.city,
      state: data.state,
      country: data.country,
      zipCode: data.zipCode,
      notes: data.notes,
      invitedCount: data.invitedCount,
      side: data.side,
      groupName: data.groupName,
      phoneAlt: data.phoneAlt,
      expectedCheck: data.expectedCheck,
      guestParty: [
        {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          ageGroup: data.ageGroup,
          isPrimaryContact: true,
          tagIds: [] as string[],
          invites,
        },
      ],
    }))
    bulkCreateMutation.mutate({ households })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-2xl'>
        {step === 'upload' ? (
          <>
            <DialogHeader>
              <DialogTitle>ייבוא אורחים מקובץ</DialogTitle>
              <DialogDescription>
                העלו קובץ CSV או Excel (.xlsx) כדי להוסיף אורחים בכמות. כל שורה הופכת למשק בית
                אחד.
                <span className='block'>
                  מספר הטלפון חייב להיות בפורמט E.164 (לדוגמה: +12025550123).
                </span>
              </DialogDescription>
            </DialogHeader>

            <FileDropzone
              onFile={handleFile}
              accept={{
                'text/csv': ['.csv'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              }}
              label='גררו ושחררו קובץ CSV או Excel, או לחצו לבחירה'
              sublabel='קובצי .csv ו-.xlsx'
              disabled={isParsing}
            />

            <DialogFooter className='mt-2 flex-row items-center justify-between sm:justify-between'>
              <Button variant='ghost' size='sm' type='button' onClick={downloadGuestCsvTemplate}>
                הורדת תבנית
              </Button>
              <Button variant='outline' type='button' onClick={handleClose}>
                ביטול
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>תצוגה מקדימה של ייבוא</DialogTitle>
              <DialogDescription>
                {fileName} &mdash; {validRows.length}{' '}
                {validRows.length !== 1 ? 'שורות תקינות' : 'שורה תקינה'}
                {invalidCount > 0 && (
                  <span className='text-destructive'>
                    {' '}
                    &middot; {invalidCount} {invalidCount !== 1 ? 'שורות' : 'שורה'} עם שגיאות
                    (ידולגו)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <PreviewTable rows={parsedRows} />

            <DialogFooter className='mt-2 flex-row items-center justify-between sm:justify-between'>
              <Button
                variant='ghost'
                size='sm'
                type='button'
                onClick={() => setStep('upload')}
                disabled={bulkCreateMutation.isPending}
              >
                חזרה
              </Button>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  type='button'
                  onClick={handleClose}
                  disabled={bulkCreateMutation.isPending}
                >
                  ביטול
                </Button>
                <Button
                  type='button'
                  onClick={handleImport}
                  disabled={validRows.length === 0 || bulkCreateMutation.isPending}
                >
                  {bulkCreateMutation.isPending
                    ? 'מייבא…'
                    : `ייבוא ${validRows.length} ${validRows.length !== 1 ? 'אורחים' : 'אורח'}`}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
