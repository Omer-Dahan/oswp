import {
  assignGuestsSchema,
  createSeatingAreaSchema,
  createSeatingTableSchema,
  isCropWithinImage,
  saveSeatingMapSchema,
  seatingEventIdSchema,
  updateSeatingAreaSchema,
} from '~/server/domains/seating/seating.validator'

describe('seating validators', () => {
  it('accepts non-uuid event ids used by seeded and imported data', () => {
    expect(seatingEventIdSchema.safeParse({ eventId: 'event-seed-ceremony' }).success).toBe(true)
  })

  it('rejects an empty event id', () => {
    expect(seatingEventIdSchema.safeParse({ eventId: '' }).success).toBe(false)
  })

  it.each([0, 31, 2.5])('rejects a capacity of %s', (capacity) => {
    const result = createSeatingTableSchema.safeParse({
      eventId: 'event-1',
      name: 'Table 1',
      shape: 'ROUND',
      capacity,
      positionX: 0,
      positionY: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown table shape', () => {
    const result = createSeatingTableSchema.safeParse({
      eventId: 'event-1',
      name: 'Table 1',
      shape: 'SQUARE',
      capacity: 8,
      positionX: 0,
      positionY: 0,
    })
    expect(result.success).toBe(false)
  })

  it('requires at least one guest to assign', () => {
    expect(assignGuestsSchema.safeParse({ tableId: 't1', guestIds: [] }).success).toBe(false)
  })
})

describe('saveSeatingMapSchema', () => {
  it('accepts a valid uploaded image URL with positive dimensions', () => {
    const result = saveSeatingMapSchema.safeParse({
      imageUrl: '/api/uploads/floor-plan.png',
      imageWidth: 3000,
      imageHeight: 2000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-uploaded-asset URL', () => {
    const result = saveSeatingMapSchema.safeParse({
      imageUrl: 'javascript:alert(1)',
      imageWidth: 3000,
      imageHeight: 2000,
    })
    expect(result.success).toBe(false)
  })

  it.each([0, -1, 2.5])('rejects an image dimension of %s', (imageWidth) => {
    const result = saveSeatingMapSchema.safeParse({
      imageUrl: '/api/uploads/floor-plan.png',
      imageWidth,
      imageHeight: 2000,
    })
    expect(result.success).toBe(false)
  })
})

describe('createSeatingAreaSchema / updateSeatingAreaSchema', () => {
  it('accepts an area at least 200px on each side', () => {
    const result = createSeatingAreaSchema.safeParse({
      name: 'אולם גדול',
      cropX: 0,
      cropY: 0,
      cropWidth: 200,
      cropHeight: 200,
    })
    expect(result.success).toBe(true)
  })

  it.each([199, 0, -10])('rejects a crop width/height of %s', (size) => {
    const result = createSeatingAreaSchema.safeParse({
      name: 'אולם גדול',
      cropX: 0,
      cropY: 0,
      cropWidth: size,
      cropHeight: 200,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative crop coordinates', () => {
    const result = createSeatingAreaSchema.safeParse({
      name: 'אולם גדול',
      cropX: -1,
      cropY: 0,
      cropWidth: 200,
      cropHeight: 200,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty or over-long area name', () => {
    expect(
      createSeatingAreaSchema.safeParse({
        name: '',
        cropX: 0,
        cropY: 0,
        cropWidth: 200,
        cropHeight: 200,
      }).success
    ).toBe(false)
    expect(
      createSeatingAreaSchema.safeParse({
        name: 'א'.repeat(41),
        cropX: 0,
        cropY: 0,
        cropWidth: 200,
        cropHeight: 200,
      }).success
    ).toBe(false)
  })

  it('rejects an initialZoom outside 0.2-4 on update', () => {
    expect(
      updateSeatingAreaSchema.safeParse({ id: 'a1', data: { initialZoom: 0.1 } }).success
    ).toBe(false)
    expect(
      updateSeatingAreaSchema.safeParse({ id: 'a1', data: { initialZoom: 4.1 } }).success
    ).toBe(false)
    expect(
      updateSeatingAreaSchema.safeParse({ id: 'a1', data: { initialZoom: 2 } }).success
    ).toBe(true)
  })

  it('allows a partial update with only some crop fields', () => {
    const result = updateSeatingAreaSchema.safeParse({ id: 'a1', data: { name: 'אולם קטן' } })
    expect(result.success).toBe(true)
  })
})

describe('isCropWithinImage', () => {
  const image = { imageWidth: 1000, imageHeight: 800 }

  it('accepts a crop that exactly fills the image', () => {
    expect(isCropWithinImage({ cropX: 0, cropY: 0, cropWidth: 1000, cropHeight: 800 }, image)).toBe(
      true
    )
  })

  it('accepts a crop fully inside the image', () => {
    expect(
      isCropWithinImage({ cropX: 100, cropY: 100, cropWidth: 200, cropHeight: 200 }, image)
    ).toBe(true)
  })

  it('rejects a crop whose right edge overflows the image width', () => {
    expect(
      isCropWithinImage({ cropX: 900, cropY: 0, cropWidth: 200, cropHeight: 200 }, image)
    ).toBe(false)
  })

  it('rejects a crop whose bottom edge overflows the image height', () => {
    expect(
      isCropWithinImage({ cropX: 0, cropY: 700, cropWidth: 200, cropHeight: 200 }, image)
    ).toBe(false)
  })
})
