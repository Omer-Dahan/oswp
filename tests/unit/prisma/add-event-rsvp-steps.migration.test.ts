import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(
  process.cwd(),
  'prisma/migrations/20261028120000_add_event_rsvp_steps/migration.sql'
)

describe('event RSVP steps migration', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('defaults events without configuration to an empty list', () => {
    expect(sql).toContain('ADD COLUMN "rsvpSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]')
  })

  it('copies each wedding list only to its primary event', () => {
    expect(sql).toContain('SET "rsvpSteps" = wedding."rsvpSteps"')
    expect(sql).toContain('event."weddingId" = wedding."id"')
    expect(sql).toContain('event."is_primary" = TRUE')
  })
})
