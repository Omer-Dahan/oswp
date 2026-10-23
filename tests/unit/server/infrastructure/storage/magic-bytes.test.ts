/**
 * @jest-environment node
 */

import { sniffType } from '~/server/infrastructure/storage/magic-bytes'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')])
const PDF = Buffer.from('%PDF-1.4\n%%EOF')
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const HTML = Buffer.from('<html><body><script>alert(1)</script></body></html>')
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00])

describe('sniffType', () => {
  it.each([
    ['image/jpeg', JPEG],
    ['image/png', PNG],
    ['image/webp', WEBP],
    ['application/pdf', PDF],
  ] as const)('accepts %s by magic bytes', (expected, buffer) => {
    expect(sniffType(buffer)).toBe(expected)
  })

  it.each([
    ['svg masquerading as xml', SVG],
    ['html with inline script', HTML],
    ['windows executable (MZ header)', EXE],
    ['empty buffer', Buffer.alloc(0)],
    ['plain text', Buffer.from('just some text')],
  ])('rejects %s', (_label, buffer) => {
    expect(sniffType(buffer)).toBeNull()
  })
})
