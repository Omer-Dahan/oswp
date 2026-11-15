import { MIN_AREA_SIZE } from '~/server/domains/seating/seating.validator'

export type DragPoint = { x: number; y: number }

export type DisplayedImage = {
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
}

export type Crop = {
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
}

const isFinitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Converts a screen drag over a displayed (possibly scaled) image into a crop
 * rectangle in the image's original pixels, ordered so a drag from any corner
 * yields the same rectangle. Returns null for malformed input or a drag too
 * small to keep, rather than a near-zero rectangle.
 */
export function cropFromDrag(args: {
  start: DragPoint | undefined
  end: DragPoint | undefined
  displayed: DisplayedImage | undefined
}): Crop | null {
  const { start, end, displayed } = args
  if (
    !start ||
    !end ||
    !displayed ||
    !isFiniteNumber(start.x) ||
    !isFiniteNumber(start.y) ||
    !isFiniteNumber(end.x) ||
    !isFiniteNumber(end.y) ||
    !isFinitePositive(displayed.width) ||
    !isFinitePositive(displayed.height) ||
    !isFinitePositive(displayed.naturalWidth) ||
    !isFinitePositive(displayed.naturalHeight)
  ) {
    return null
  }

  const scaleX = displayed.naturalWidth / displayed.width
  const scaleY = displayed.naturalHeight / displayed.height

  const left = Math.max(0, Math.min(start.x, end.x, displayed.width))
  const top = Math.max(0, Math.min(start.y, end.y, displayed.height))
  const right = Math.min(displayed.width, Math.max(start.x, end.x, 0))
  const bottom = Math.min(displayed.height, Math.max(start.y, end.y, 0))

  const cropX = Math.round(left * scaleX)
  const cropY = Math.round(top * scaleY)
  const cropWidth = Math.round((right - left) * scaleX)
  const cropHeight = Math.round((bottom - top) * scaleY)

  if (cropWidth < MIN_AREA_SIZE || cropHeight < MIN_AREA_SIZE) return null

  return { cropX, cropY, cropWidth, cropHeight }
}

/**
 * Clamps a crop to its source image and enforces the minimum area size, so a
 * resize dragged past an edge (or a stale draft from a replaced map) always
 * lands on a valid rectangle instead of one a mutation would reject.
 */
export function clampCrop(crop: Crop, image: { imageWidth: number; imageHeight: number }): Crop {
  const cropWidth = Math.min(Math.max(crop.cropWidth, MIN_AREA_SIZE), image.imageWidth)
  const cropHeight = Math.min(Math.max(crop.cropHeight, MIN_AREA_SIZE), image.imageHeight)
  const cropX = Math.min(Math.max(crop.cropX, 0), image.imageWidth - cropWidth)
  const cropY = Math.min(Math.max(crop.cropY, 0), image.imageHeight - cropHeight)
  return { cropX, cropY, cropWidth, cropHeight }
}

/**
 * Inverse of the scaling in cropFromDrag: where a natural-pixel crop sits on
 * the currently displayed image, for drawing the overlay rectangle and handles.
 */
export function cropToDisplayRect(
  crop: Crop,
  displayed: DisplayedImage
): { left: number; top: number; width: number; height: number } {
  const scaleX = displayed.naturalWidth / displayed.width
  const scaleY = displayed.naturalHeight / displayed.height
  return {
    left: crop.cropX / scaleX,
    top: crop.cropY / scaleY,
    width: crop.cropWidth / scaleX,
    height: crop.cropHeight / scaleY,
  }
}
