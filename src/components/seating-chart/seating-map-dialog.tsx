'use client'

/**
 * "מפת אולם" dialog, step א: upload a floor-plan image, define display areas
 * on it with numeric crop fields, and pick the one active area the chart
 * renders against. Mouse-drawn rectangles are step ב.
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { uploadFile } from '~/lib/upload-client'
import { DROPZONE_ACCEPT, MAX_FILE_SIZE } from '~/lib/upload-config'
import {
  isCropWithinImage,
  seatingAreaNameSchema,
} from '~/server/domains/seating/seating.validator'
import { api } from '~/trpc/react'

type SeatingMapDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// PDF is explicitly out of scope: this dialog only ever accepts images
const MAP_DROPZONE_ACCEPT = Object.fromEntries(
  Object.entries(DROPZONE_ACCEPT).filter(([mimeType]) => mimeType !== 'application/pdf')
)
const ACCEPTED_IMAGE_TYPES = Object.keys(MAP_DROPZONE_ACCEPT)
const MAP_ACCEPT_ATTR = Object.values(MAP_DROPZONE_ACCEPT).flat().join(',')
const MAX_IMAGE_DIMENSION = 4000
const MIN_AREA_SIZE = 200

const areaDraftSchema = z.object({
  name: seatingAreaNameSchema,
  cropX: z.number().int().min(0),
  cropY: z.number().int().min(0),
  cropWidth: z.number().int().min(MIN_AREA_SIZE),
  cropHeight: z.number().int().min(MIN_AREA_SIZE),
  initialZoom: z.number().min(0.2).max(4),
})

type AreaDraft = z.infer<typeof areaDraftSchema>

const readImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('invalid image'))
    }
    img.src = url
  })

/** Shrinks an oversized image client-side; /api/uploads caps at 10MB. */
async function downscaleIfNeeded(
  file: File,
  width: number,
  height: number
): Promise<{ file: File; width: number; height: number }> {
  if (width <= MAX_IMAGE_DIMENSION) return { file, width, height }
  const targetWidth = MAX_IMAGE_DIMENSION
  const targetHeight = Math.round(height * (MAX_IMAGE_DIMENSION / width))
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) return { file, width, height }
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, file.type || 'image/png')
  )
  if (!blob) return { file, width, height }
  return { file: new File([blob], file.name, { type: blob.type }), width: targetWidth, height: targetHeight }
}

const cropFields: Array<{ key: keyof AreaDraft; label: string }> = [
  { key: 'cropX', label: 'X' },
  { key: 'cropY', label: 'Y' },
  { key: 'cropWidth', label: 'רוחב' },
  { key: 'cropHeight', label: 'גובה' },
]

export function SeatingMapDialog(props: Readonly<SeatingMapDialogProps>) {
  const { open, onOpenChange } = props
  const utils = api.useUtils()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [replaceConfirm, setReplaceConfirm] = useState<string | null>(null)
  const [pendingUpload, setPendingUpload] = useState<{
    imageUrl: string
    imageWidth: number
    imageHeight: number
  } | null>(null)
  const [draft, setDraft] = useState<AreaDraft | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<AreaDraft | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [pendingDeleteAreaId, setPendingDeleteAreaId] = useState<string | null>(null)

  const mapQuery = api.seating.getMap.useQuery(undefined, { enabled: open })
  const invalidateMap = () => utils.seating.getMap.invalidate()

  const saveMap = api.seating.saveMap.useMutation({
    onSuccess: () => {
      setReplaceConfirm(null)
      setPendingUpload(null)
      toast.success('מפת האולם הועלתה')
      void invalidateMap()
    },
    onError: (error) => {
      if (error.data?.code === 'CONFLICT') {
        setReplaceConfirm(error.message)
        return
      }
      toast.error(error.message || 'העלאת המפה נכשלה')
      setPendingUpload(null)
    },
  })

  const createArea = api.seating.createArea.useMutation({
    onSuccess: () => {
      setDraft(null)
      setDraftError(null)
      void invalidateMap()
    },
    onError: (error) => toast.error(error.message || 'יצירת האזור נכשלה'),
  })

  const updateArea = api.seating.updateArea.useMutation({
    onSuccess: () => {
      setEditingAreaId(null)
      setEditDraft(null)
      setEditError(null)
      void invalidateMap()
    },
    onError: (error) => toast.error(error.message || 'שמירת האזור נכשלה'),
  })

  const deleteArea = api.seating.deleteArea.useMutation({
    onSuccess: () => void invalidateMap(),
    onError: (error) => toast.error(error.message || 'מחיקת האזור נכשלה'),
  })

  const setActiveArea = api.seating.setActiveArea.useMutation({
    onSuccess: () => void invalidateMap(),
    onError: (error) => toast.error(error.message || 'קביעת האזור הפעיל נכשלה'),
  })

  const map = mapQuery.data?.map ?? null
  const areas = mapQuery.data?.areas ?? []
  const activeAreaId = mapQuery.data?.activeArea?.id ?? null

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('ניתן להעלות קובץ תמונה בלבד (PNG, JPG או WebP). קבצי PDF אינם נתמכים כרגע.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('גודל הקובץ חייב להיות עד 10MB')
      return
    }
    setIsUploading(true)
    try {
      const original = await readImageDimensions(file)
      const { file: finalFile, width, height } = await downscaleIfNeeded(
        file,
        original.width,
        original.height
      )
      const uploaded = await uploadFile(finalFile)
      const payload = { imageUrl: uploaded.url, imageWidth: width, imageHeight: height }
      setPendingUpload(payload)
      saveMap.mutate(payload)
    } catch {
      toast.error('העלאת המפה נכשלה. נסו שוב.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const startNewArea = () => {
    if (!map) return
    setDraft({
      name: `אזור ${areas.length + 1}`,
      cropX: 0,
      cropY: 0,
      cropWidth: map.imageWidth,
      cropHeight: map.imageHeight,
      initialZoom: 1,
    })
    setDraftError(null)
  }

  const submitNewArea = () => {
    if (!draft || !map) return
    const parsed = areaDraftSchema.safeParse(draft)
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message ?? 'ערכים לא תקינים')
      return
    }
    if (!isCropWithinImage(parsed.data, map)) {
      setDraftError('אזור החיתוך חורג מגבולות התמונה')
      return
    }
    createArea.mutate(parsed.data)
  }

  const startEditArea = (area: (typeof areas)[number]) => {
    setEditingAreaId(area.id)
    setEditDraft({
      name: area.name,
      cropX: area.cropX,
      cropY: area.cropY,
      cropWidth: area.cropWidth,
      cropHeight: area.cropHeight,
      initialZoom: area.initialZoom,
    })
    setEditError(null)
  }

  const submitEditArea = () => {
    if (!editingAreaId || !editDraft || !map) return
    const parsed = areaDraftSchema.safeParse(editDraft)
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? 'ערכים לא תקינים')
      return
    }
    if (!isCropWithinImage(parsed.data, map)) {
      setEditError('אזור החיתוך חורג מגבולות התמונה')
      return
    }
    updateArea.mutate({ id: editingAreaId, data: parsed.data })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle className='font-display text-2xl italic'>מפת אולם</DialogTitle>
            <DialogDescription>
              העלו תמונה של תוכנית האולם, הגדירו אזורי תצוגה עליה, ובחרו אזור אחד שהתרשים יצייר.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-5'>
            <section className='space-y-2'>
              <input
                ref={fileInputRef}
                type='file'
                accept={MAP_ACCEPT_ATTR}
                className='hidden'
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <div className='flex items-center justify-between gap-3'>
                <div className='text-sm'>
                  {map ? (
                    <span className='text-muted-foreground'>
                      מפה קיימת: {map.imageWidth}×{map.imageHeight} פיקסלים
                    </span>
                  ) : (
                    <span className='text-muted-foreground'>לא הועלתה מפה עדיין</span>
                  )}
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? 'מעלה…' : map ? 'החלפת מפה' : 'העלאת מפה'}
                </Button>
              </div>
            </section>

            {map ? (
              <section className='space-y-3 border-t border-border pt-4'>
                <div className='flex items-center justify-between'>
                  <Label className='font-mono text-[0.62rem] text-foreground/55 uppercase tracking-[0.1em]'>
                    אזורי תצוגה
                  </Label>
                  <Button type='button' variant='outline' size='sm' onClick={startNewArea}>
                    אזור חדש
                  </Button>
                </div>

                <ul className='space-y-2'>
                  {areas.map((area) =>
                    editingAreaId === area.id && editDraft ? (
                      <li key={area.id} className='space-y-2 rounded-[10px] border border-border p-3'>
                        <Input
                          value={editDraft.name}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          placeholder='שם האזור'
                        />
                        <div className='grid grid-cols-4 gap-2'>
                          {cropFields.map(({ key, label }) => (
                            <div key={key} className='space-y-1'>
                              <Label className='text-xs'>{label}</Label>
                              <Input
                                type='number'
                                value={editDraft[key]}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, [key]: Number(e.target.value) })
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <div className='space-y-1'>
                          <Label className='text-xs'>זום פתיחה</Label>
                          <Input
                            type='number'
                            step='0.1'
                            value={editDraft.initialZoom}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, initialZoom: Number(e.target.value) })
                            }
                          />
                        </div>
                        {editError ? <p className='text-destructive text-sm'>{editError}</p> : null}
                        <div className='flex justify-end gap-2'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              setEditingAreaId(null)
                              setEditDraft(null)
                              setEditError(null)
                            }}
                          >
                            ביטול
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            disabled={updateArea.isPending}
                            onClick={submitEditArea}
                          >
                            שמירה
                          </Button>
                        </div>
                      </li>
                    ) : (
                      <li
                        key={area.id}
                        className='flex items-center justify-between gap-3 rounded-[10px] border border-border p-3'
                      >
                        <div className='min-w-0'>
                          <p className='truncate font-medium text-sm'>
                            {area.name}
                            {activeAreaId === area.id ? (
                              <span className='ms-2 font-mono text-[0.6rem] text-primary uppercase tracking-wide'>
                                פעיל
                              </span>
                            ) : null}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            {area.cropWidth}×{area.cropHeight} פיקסלים
                          </p>
                        </div>
                        <div className='flex flex-shrink-0 gap-2'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={activeAreaId === area.id || setActiveArea.isPending}
                            onClick={() => setActiveArea.mutate({ areaId: area.id })}
                          >
                            קבעו כאזור פעיל
                          </Button>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => startEditArea(area)}
                          >
                            עריכה
                          </Button>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => setPendingDeleteAreaId(area.id)}
                          >
                            מחיקה
                          </Button>
                        </div>
                      </li>
                    )
                  )}
                </ul>

                {draft ? (
                  <div className='space-y-2 rounded-[10px] border border-dashed border-border p-3'>
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder='שם האזור'
                    />
                    <div className='grid grid-cols-4 gap-2'>
                      {cropFields.map(({ key, label }) => (
                        <div key={key} className='space-y-1'>
                          <Label className='text-xs'>{label}</Label>
                          <Input
                            type='number'
                            value={draft[key]}
                            onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                          />
                        </div>
                      ))}
                    </div>
                    {draftError ? <p className='text-destructive text-sm'>{draftError}</p> : null}
                    <div className='flex justify-end gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setDraft(null)
                          setDraftError(null)
                        }}
                      >
                        ביטול
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        disabled={createArea.isPending}
                        onClick={submitNewArea}
                      >
                        הוספת אזור
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={replaceConfirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReplaceConfirm(null)
            setPendingUpload(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>להחליף את מפת האולם?</AlertDialogTitle>
            <AlertDialogDescription>{replaceConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setReplaceConfirm(null)
                setPendingUpload(null)
              }}
            >
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingUpload) saveMap.mutate({ ...pendingUpload, confirmReplace: true })
                setReplaceConfirm(null)
              }}
            >
              החליפו מפה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteAreaId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteAreaId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את האזור הזה?</AlertDialogTitle>
            <AlertDialogDescription>
              אם זה האזור הפעיל, התרשים יחזור לרשת הנקודות הרגילה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteAreaId) deleteArea.mutate({ id: pendingDeleteAreaId })
                setPendingDeleteAreaId(null)
              }}
            >
              מחקו אזור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
