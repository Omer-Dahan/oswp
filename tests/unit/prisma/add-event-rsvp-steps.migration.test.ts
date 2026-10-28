import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(
  process.cwd(),
  'prisma/migrations/20261028120000_add_event_rsvp_steps/migration.sql'
)

describe('event RSVP steps migration', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  const backfillSql = sql.slice(sql.indexOf('UPDATE "Event"'))

  it('defaults events without configuration to an empty list', () => {
    expect(sql).toContain('ADD COLUMN "rsvpSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]')
  })

  it('copies each wedding list to every RSVP-collecting event except the chuppah', () => {
    expect(backfillSql).toContain('SET "rsvpSteps" = wedding."rsvpSteps"')
    expect(backfillSql).toContain('event."weddingId" = wedding."id"')
    expect(backfillSql).toContain('event."collectRsvp" = TRUE')
    expect(backfillSql).toContain(`event."name" !~* '(חופה|ceremony)'`)
    expect(backfillSql).not.toContain('event."is_primary"')
  })

  it('does not backfill a primary event named החופה', () => {
    const sqlPattern = backfillSql.match(/event\."name"\s+!~\*\s+'([^']+)'/)?.[1]
    if (!sqlPattern) throw new Error('The backfill must exclude chuppah names in SQL')

    const receivesBackfill = (event: {
      name: string
      collectRsvp: boolean
      isPrimary: boolean
    }): boolean => event.collectRsvp && !new RegExp(sqlPattern, 'i').test(event.name)

    expect(receivesBackfill({ name: 'החופה', collectRsvp: true, isPrimary: true })).toBe(false)
    expect(receivesBackfill({ name: 'The Ceremony', collectRsvp: true, isPrimary: false })).toBe(
      false
    )
    expect(receivesBackfill({ name: 'החתונה', collectRsvp: true, isPrimary: false })).toBe(true)
  })
})
