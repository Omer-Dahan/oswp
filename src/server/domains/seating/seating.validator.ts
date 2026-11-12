import { z } from 'zod'

import { uploadedAssetUrlSchema } from '~/lib/upload-config'
import { MAX_TABLE_CAPACITY, MIN_TABLE_CAPACITY } from '~/server/domains/seating/seating.rules'

export const seatingTableShapeSchema = z.enum(['ROUND', 'RECTANGULAR'])

export const tableNameSchema = z
  .string()
  .trim()
  .min(1, 'Table name is required')
  .max(50, 'Table name must be 50 characters or less')

const capacitySchema = z
  .number()
  .int()
  .min(MIN_TABLE_CAPACITY, `Tables need at least ${MIN_TABLE_CAPACITY} seat`)
  .max(MAX_TABLE_CAPACITY, `Tables can have at most ${MAX_TABLE_CAPACITY} seats`)

const positionSchema = z.number().int().min(0).max(10_000)

const guestIdsSchema = z.array(z.number().int().positive()).min(1).max(200)

export const seatingEventIdSchema = z.object({ eventId: z.string().min(1) })

export const createSeatingTableSchema = z.object({
  eventId: z.string().min(1),
  name: tableNameSchema,
  shape: seatingTableShapeSchema,
  capacity: capacitySchema,
  positionX: positionSchema,
  positionY: positionSchema,
})

export const updateSeatingTableSchema = z.object({
  id: z.string().min(1),
  data: z.object({
    name: tableNameSchema.optional(),
    shape: seatingTableShapeSchema.optional(),
    capacity: capacitySchema.optional(),
    positionX: positionSchema.optional(),
    positionY: positionSchema.optional(),
  }),
})

export const seatingTableIdSchema = z.object({ id: z.string().min(1) })

export const assignGuestsSchema = z.object({
  tableId: z.string().min(1),
  guestIds: guestIdsSchema,
})

export const unassignGuestsSchema = z.object({
  eventId: z.string().min(1),
  guestIds: guestIdsSchema,
})

export const autoSeatSchema = z.object({
  eventId: z.string().min(1),
  fillFreeSeatsOnly: z.boolean().default(true),
})

const groupSideSchema = z.string().min(1).nullable()
const groupNameSchema = z.string().min(1).nullable()

export const suggestForGroupSchema = z.object({
  eventId: z.string().min(1),
  side: groupSideSchema,
  groupName: groupNameSchema,
})

export const applyGroupPlacementSchema = z.object({
  eventId: z.string().min(1),
  tableId: z.string().min(1),
  householdIds: z.array(z.string().min(1)).min(1).max(200),
})

const MIN_AREA_SIZE = 200

export const seatingAreaNameSchema = z
  .string()
  .trim()
  .min(1, 'Area name is required')
  .max(40, 'Area name must be 40 characters or less')

const cropCoordinateSchema = z.number().int().min(0)
const cropSizeSchema = z.number().int().min(MIN_AREA_SIZE)
const initialZoomSchema = z.number().min(0.2).max(4)

export const saveSeatingMapSchema = z.object({
  imageUrl: uploadedAssetUrlSchema,
  imageWidth: z.number().int().positive().max(20_000),
  imageHeight: z.number().int().positive().max(20_000),
  confirmReplace: z.boolean().optional(),
})

export const createSeatingAreaSchema = z.object({
  name: seatingAreaNameSchema,
  cropX: cropCoordinateSchema,
  cropY: cropCoordinateSchema,
  cropWidth: cropSizeSchema,
  cropHeight: cropSizeSchema,
})

export const updateSeatingAreaSchema = z.object({
  id: z.string().min(1),
  data: z.object({
    name: seatingAreaNameSchema.optional(),
    cropX: cropCoordinateSchema.optional(),
    cropY: cropCoordinateSchema.optional(),
    cropWidth: cropSizeSchema.optional(),
    cropHeight: cropSizeSchema.optional(),
    initialZoom: initialZoomSchema.optional(),
  }),
})

export const seatingAreaIdSchema = z.object({ id: z.string().min(1) })

export const setActiveSeatingAreaSchema = z.object({ areaId: z.string().min(1) })

/**
 * Whether a crop rectangle fits inside its source image. Checked separately
 * from the zod schemas above because createArea/updateArea only validate
 * the fields the caller sent — the image's dimensions are only known once
 * the map this area belongs to has been loaded.
 */
export function isCropWithinImage(
  crop: { cropX: number; cropY: number; cropWidth: number; cropHeight: number },
  image: { imageWidth: number; imageHeight: number }
): boolean {
  return (
    crop.cropX + crop.cropWidth <= image.imageWidth &&
    crop.cropY + crop.cropHeight <= image.imageHeight
  )
}
