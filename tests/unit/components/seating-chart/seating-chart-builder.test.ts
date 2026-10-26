import { downloadCsv } from '~/components/seating-chart/seating-chart-builder'

describe('downloadCsv', () => {
  it('prepends a UTF-8 BOM so Excel decodes Hebrew text instead of mangling it', async () => {
    const csv = 'Guest Name,Table\r\nדוד לוי,שולחן 1'
    let blob: Blob | undefined
    const createObjectURL = jest.fn((value: Blob) => {
      blob = value
      return 'blob:mock'
    })
    const revokeObjectURL = jest.fn()
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadCsv('seating-test.csv', csv)
    click.mockRestore()

    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(blob!)
    })
    const bytes = new Uint8Array(buffer)
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
    expect(Buffer.from(bytes).toString('utf8')).toBe('﻿' + csv)
  })
})
