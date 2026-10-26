/**
 * GET /api/reports/kitchen?eventId=... — the kitchen sheet as an .xlsx file.
 *
 * exceljs is a ~900KB chunk, so it's only pulled in once a download is
 * actually requested, never at build/import time.
 */

import { TRPCError } from '@trpc/server'
import { NextResponse } from 'next/server'

import type { KitchenReport, KitchenReportRow } from '~/lib/reports/kitchen-report'
import { getAuthErrorCode, isAccessError } from '~/server/authz/auth-error-helpers'
import { api } from '~/trpc/server'

function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event'
  )
}

const SUMMARY_HEADERS = ['מדד', 'ערך']
const ROW_HEADERS = ['שם האורח', 'משק בית', 'שולחן', 'הערה']

function addRowsSheet(
  workbook: import('exceljs').Workbook,
  name: string,
  rows: KitchenReportRow[],
  noteLabel: (row: KitchenReportRow) => string
) {
  const sheet = workbook.addWorksheet(name, { views: [{ rightToLeft: true }] })
  sheet.columns = [
    { header: ROW_HEADERS[0], key: 'guestName', width: 24 },
    { header: ROW_HEADERS[1], key: 'householdName', width: 24 },
    { header: ROW_HEADERS[2], key: 'tableName', width: 14 },
    { header: ROW_HEADERS[3], key: 'note', width: 30 },
  ]
  sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
  for (const row of rows) {
    sheet.addRow({
      guestName: row.guestName,
      householdName: row.householdName,
      tableName: row.tableName ?? '',
      note: noteLabel(row),
    })
  }
  return sheet
}

async function buildWorkbook(report: KitchenReport) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()

  const summarySheet = workbook.addWorksheet('סיכום', { views: [{ rightToLeft: true }] })
  summarySheet.columns = [
    { header: SUMMARY_HEADERS[0], key: 'metric', width: 24 },
    { header: SUMMARY_HEADERS[1], key: 'value', width: 14 },
  ]
  summarySheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
  summarySheet.addRow({ metric: 'מגיעים', value: report.summary.attending })
  summarySheet.addRow({ metric: 'מנות', value: report.summary.meals })
  summarySheet.addRow({ metric: 'ילדים', value: report.summary.children })
  summarySheet.addRow({ metric: 'הגבלות תזונה', value: report.summary.dietary })

  addRowsSheet(
    workbook,
    'ילדים',
    report.rows.filter((row) => row.isChild),
    () => 'ילדים'
  )

  addRowsSheet(
    workbook,
    'הגבלות תזונה',
    report.rows.filter((row) => row.dietaryNote !== null),
    (row) => row.dietaryNote ?? ''
  )

  const hasAssignments = report.rows.some((row) => row.tableName !== null)
  if (hasAssignments) {
    const byTableSheet = workbook.addWorksheet('לפי שולחן', { views: [{ rightToLeft: true }] })
    byTableSheet.columns = [
      { header: 'שולחן', key: 'tableName', width: 14 },
      { header: ROW_HEADERS[0], key: 'guestName', width: 24 },
      { header: ROW_HEADERS[1], key: 'householdName', width: 24 },
      { header: ROW_HEADERS[3], key: 'note', width: 30 },
    ]
    byTableSheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
    for (const row of report.rows) {
      byTableSheet.addRow({
        tableName: row.tableName ?? 'ללא שולחן',
        guestName: row.guestName,
        householdName: row.householdName,
        note: row.dietaryNote ?? '',
      })
    }
  }

  return workbook
}

export async function GET(request: Request): Promise<Response> {
  const eventId = new URL(request.url).searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
  }

  try {
    const { report, eventName } = await api.report.getKitchenReportForExport({ eventId })
    const workbook = await buildWorkbook(report)
    const buffer = await workbook.xlsx.writeBuffer()
    const date = new Date().toISOString().slice(0, 10)
    const fileName = `kitchen-${slugify(eventName)}-${date}.xlsx`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
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
