/**
 * Report Domain - service wiring
 */

import { ReportRepository } from '~/server/domains/report/report.repository'
import { ReportService } from '~/server/domains/report/report.service'
import { db } from '~/server/infrastructure/database'

export const reportService = new ReportService(new ReportRepository(db))
