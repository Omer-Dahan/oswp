import { describe, expect, it } from '@jest/globals'

import {
  clampCrop,
  cropFromDrag,
  cropToDisplayRect,
} from '~/components/seating-chart/map-crop-geometry'

const displayed = { width: 400, height: 300, naturalWidth: 800, naturalHeight: 600 }

describe('cropFromDrag', () => {
  it('drags from the top-left corner', () => {
    expect(cropFromDrag({ start: { x: 10, y: 10 }, end: { x: 210, y: 160 }, displayed })).toEqual(
      { cropX: 20, cropY: 20, cropWidth: 400, cropHeight: 300 }
    )
  })

  it('drags from the top-right corner', () => {
    expect(cropFromDrag({ start: { x: 210, y: 10 }, end: { x: 10, y: 160 }, displayed })).toEqual(
      { cropX: 20, cropY: 20, cropWidth: 400, cropHeight: 300 }
    )
  })

  it('drags from the bottom-left corner', () => {
    expect(cropFromDrag({ start: { x: 10, y: 160 }, end: { x: 210, y: 10 }, displayed })).toEqual(
      { cropX: 20, cropY: 20, cropWidth: 400, cropHeight: 300 }
    )
  })

  it('drags from the bottom-right corner', () => {
    expect(cropFromDrag({ start: { x: 210, y: 160 }, end: { x: 10, y: 10 }, displayed })).toEqual(
      { cropX: 20, cropY: 20, cropWidth: 400, cropHeight: 300 }
    )
  })

  it('returns null for a drag smaller than the minimum area size', () => {
    expect(
      cropFromDrag({ start: { x: 10, y: 10 }, end: { x: 20, y: 20 }, displayed })
    ).toBeNull()
  })

  it('clamps a drag that runs past the displayed image bounds', () => {
    expect(
      cropFromDrag({ start: { x: -50, y: -50 }, end: { x: 5000, y: 5000 }, displayed })
    ).toEqual({ cropX: 0, cropY: 0, cropWidth: 800, cropHeight: 600 })
  })

  it('scales a drag on an image displayed smaller than its natural size', () => {
    const scaled = { width: 200, height: 150, naturalWidth: 800, naturalHeight: 600 }
    expect(cropFromDrag({ start: { x: 0, y: 0 }, end: { x: 100, y: 100 }, displayed: scaled })).toEqual(
      { cropX: 0, cropY: 0, cropWidth: 400, cropHeight: 400 }
    )
  })

  it('returns null for incomplete or malformed input', () => {
    expect(
      cropFromDrag({ start: undefined, end: { x: 100, y: 100 }, displayed })
    ).toBeNull()
    expect(
      cropFromDrag({ start: { x: 0, y: 0 }, end: { x: 100, y: 100 }, displayed: undefined })
    ).toBeNull()
    expect(
      cropFromDrag({
        start: { x: Number.NaN, y: 0 },
        end: { x: 100, y: 100 },
        displayed,
      })
    ).toBeNull()
    expect(
      cropFromDrag({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        displayed: { width: 0, height: 300, naturalWidth: 800, naturalHeight: 600 },
      })
    ).toBeNull()
  })
})

describe('clampCrop', () => {
  it('keeps a crop that already fits unchanged', () => {
    const crop = { cropX: 10, cropY: 10, cropWidth: 300, cropHeight: 250 }
    expect(clampCrop(crop, { imageWidth: 800, imageHeight: 600 })).toEqual(crop)
  })

  it('pulls a crop back inside the image bounds', () => {
    const crop = { cropX: 700, cropY: 500, cropWidth: 300, cropHeight: 250 }
    expect(clampCrop(crop, { imageWidth: 800, imageHeight: 600 })).toEqual({
      cropX: 500,
      cropY: 350,
      cropWidth: 300,
      cropHeight: 250,
    })
  })

  it('enforces the minimum area size', () => {
    const crop = { cropX: 0, cropY: 0, cropWidth: 50, cropHeight: 50 }
    const result = clampCrop(crop, { imageWidth: 800, imageHeight: 600 })
    expect(result.cropWidth).toBe(200)
    expect(result.cropHeight).toBe(200)
  })
})

describe('cropToDisplayRect', () => {
  it('inverts cropFromDrag back to displayed-space coordinates', () => {
    const crop = { cropX: 20, cropY: 20, cropWidth: 400, cropHeight: 300 }
    expect(cropToDisplayRect(crop, displayed)).toEqual({
      left: 10,
      top: 10,
      width: 200,
      height: 150,
    })
  })
})
