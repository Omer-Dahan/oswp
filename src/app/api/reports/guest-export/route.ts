/**
 * GET /api/reports/guest-export?eventId=...&side=...&group=... — confirmed
 * guests for one event, in the couple's own Excel template, as an .xlsx file.
 *
 * exceljs is a ~900KB chunk, so it's only pulled in once a download is
 * actually requested (inside the lib builder), never at build/import time.
 */

import { TRPCError } from '@trpc/server'
import { NextResponse } from 'next/server'

import { buildGuestExportWorkbook } from '~/lib/reports/guest-export-xlsx'
import { getAuthErrorCode, isAccessError } from '~/server/authz/auth-error-helpers'
import { api } from '~/trpc/server'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const eventId = url.searchParams.get('eventId')
  const side = url.searchParams.get('side') ?? undefined
  const group = url.searchParams.get('group') ?? undefined
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
  }

  try {
    const { rows } = await api.report.getGuestExportForDownload({ eventId, side, group })
    const workbook = await buildGuestExportWorkbook(rows)
    const buffer = await workbook.xlsx.writeBuffer()
    const date = new Date().toISOString().slice(0, 10)
    const fileName = side ? `הזמנות-${side}-${date}.xlsx` : `הזמנות-${date}.xlsx`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="guest-export.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    })
  } catch (error) {
    if (error instanceof TRPCError || isAccessError(error)) {
      const code = getAuthErrorCode(error)
      const status = code === 'NOT_FOUND' ? 404 : code === 'UNAUTHORIZED' ? 401 : 403
      return NextResponse.json({ error: 'Forbidden' }, { status })
    }
    throw error
  }
}
