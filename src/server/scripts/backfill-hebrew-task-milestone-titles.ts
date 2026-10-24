import { fileURLToPath } from 'node:url'
import { parseDryRunArgs } from '~/server/scripts/script-args'
import { TASK_SEED } from '~/server/domains/task/task.seed'
import { MILESTONE_SEED } from '~/server/domains/milestone/milestone.seed'

type DatabaseClient = Awaited<typeof import('~/server/db')>['db']

type ParsedArgs = {
  dryRun: boolean
}

export const parseArgs = (argv: string[]): ParsedArgs => ({
  dryRun: parseDryRunArgs(argv).dryRun,
})

// The English titles the seed files used before the Hebrew translation.
// Rows are only rewritten when the stored title still matches this value
// for the row's seedKey/key, so user-edited titles are never touched.
const OLD_ENGLISH_TASK_TITLES: Record<string, string> = {
  set_wedding_budget: 'Set the wedding budget',
  decide_rough_guest_count: 'Decide rough guest count',
  decide_ceremony_location_region: 'Decide ceremony location/region',
  tour_ceremony_venues: 'Tour ceremony venues',
  tour_reception_venues: 'Tour reception venues (if separate from ceremony)',
  book_ceremony_venue: 'Book ceremony venue',
  book_reception_venue: 'Book reception venue (if separate)',
  hire_wedding_planner: 'Hire wedding planner (optional)',
  decide_overall_vision_style: 'Decide on overall vision and style',
  start_attire_research: 'Start research on dress / suit options',
  finalize_guest_list_first_pass: 'Finalize guest list (first pass)',
  book_photographer: 'Book photographer',
  book_videographer: 'Book videographer (optional)',
  book_caterer: 'Book caterer',
  choose_officiant: 'Choose officiant',
  send_save_the_dates: 'Send save-the-dates',
  order_wedding_attire: 'Order or buy wedding dress / suit',
  book_dj_or_band: 'Book DJ or band',
  set_up_wedding_website: 'Set up wedding website',
  block_hotel_rooms: 'Block hotel rooms for out-of-town guests',
  book_florist: 'Book florist',
  book_hair_makeup_artist: 'Book hair & makeup artist',
  choose_wedding_party: 'Choose wedding party',
  order_wedding_party_attire: 'Order wedding party attire',
  plan_honeymoon: 'Plan honeymoon',
  choose_ceremony_readings_music: 'Choose ceremony readings and music',
  order_wedding_bands: 'Order wedding bands',
  decide_invitation_design: 'Decide on invitation design',
  order_stationery_suite: 'Order full stationery suite',
  send_formal_invitations: 'Send formal invitations',
  schedule_attire_fittings: 'Schedule dress / suit fittings',
  write_vows: 'Write vows',
  plan_rehearsal_dinner: 'Plan rehearsal dinner',
  research_marriage_license_requirements: 'Research marriage license requirements',
  confirm_vendor_details: 'Confirm details with all booked vendors',
  plan_ceremony_order_timing: 'Plan ceremony order and timing',
  buy_wedding_rings: 'Buy wedding rings (if not already done)',
  collect_outstanding_rsvps: 'Collect outstanding RSVPs',
  send_final_headcount_to_caterer: 'Send final headcount to caterer',
  create_seating_chart: 'Create seating chart',
  final_attire_fitting: 'Final dress / suit fitting',
  confirm_transportation_arrangements: 'Confirm transportation arrangements',
  confirm_honeymoon_details: 'Confirm honeymoon details',
  get_marriage_license: 'Get marriage license',
  pay_remaining_vendor_balances: 'Pay remaining vendor balances',
  pack_for_honeymoon: 'Pack for honeymoon',
  confirm_vendor_arrival_times: 'Confirm vendor arrival times',
  provide_shot_list_to_photographer: 'Provide shot list to photographer',
  final_venue_walkthrough: 'Final venue walkthrough',
  pick_up_wedding_rings: 'Pick up wedding rings',
  break_in_wedding_shoes: 'Break in wedding shoes (if new)',
  wedding_rehearsal: 'Wedding rehearsal',
  rehearsal_dinner: 'Rehearsal dinner',
  pack_overnight_bag: 'Pack overnight bag',
  hair_and_makeup: 'Hair and makeup',
  hand_off_rings_to_officiant: 'Hand off rings to officiant',
  enjoy_the_day: 'Enjoy the day',
  send_thank_you_notes: 'Send thank-you notes',
}

const OLD_ENGLISH_MILESTONE_TITLES: Record<string, string> = {
  date_set: 'Date set',
  guest_list_drafted: 'Guest list drafted',
  venue_booked: 'Venue booked',
  photographer_booked: 'Photographer booked',
  caterer_booked: 'Caterer booked',
  florist_booked: 'Florist booked',
  save_the_dates_sent: 'Save-the-dates sent',
  invitations_sent: 'Invitations sent',
  rsvps_collected: 'RSVPs collected',
  officiant_chosen: 'Officiant chosen',
  marriage_license_obtained: 'Marriage license obtained',
  final_headcount_sent: 'Final headcount sent to caterer',
  wedding_day: 'Wedding day',
}

const NEW_TASK_TITLES: Record<string, string> = Object.fromEntries(
  TASK_SEED.map((task) => [task.seedKey, task.title])
)

const NEW_MILESTONE_TITLES: Record<string, string> = Object.fromEntries(
  MILESTONE_SEED.map((milestone) => [milestone.key, milestone.title])
)

export async function backfillHebrewTitles(
  db: DatabaseClient,
  dryRun = true
): Promise<{ tasksUpdated: number; milestonesUpdated: number }> {
  const taskRows = await db.task.findMany({
    where: { seedKey: { not: null } },
    select: { id: true, seedKey: true, title: true },
  })

  let tasksUpdated = 0
  for (const row of taskRows) {
    if (!row.seedKey) continue
    const oldTitle = OLD_ENGLISH_TASK_TITLES[row.seedKey]
    const newTitle = NEW_TASK_TITLES[row.seedKey]
    if (!oldTitle || !newTitle || row.title !== oldTitle) continue

    tasksUpdated += 1
    if (!dryRun) {
      await db.task.update({ where: { id: row.id }, data: { title: newTitle } })
    }
  }

  const milestoneRows = await db.milestone.findMany({
    select: { id: true, key: true, title: true },
  })

  let milestonesUpdated = 0
  for (const row of milestoneRows) {
    const oldTitle = OLD_ENGLISH_MILESTONE_TITLES[row.key]
    const newTitle = NEW_MILESTONE_TITLES[row.key]
    if (!oldTitle || !newTitle || row.title !== oldTitle) continue

    milestonesUpdated += 1
    if (!dryRun) {
      await db.milestone.update({ where: { id: row.id }, data: { title: newTitle } })
    }
  }

  return { tasksUpdated, milestonesUpdated }
}

const run = async (): Promise<void> => {
  const { db } = await import('~/server/db')
  const args = parseArgs(process.argv.slice(2))
  const summary = await backfillHebrewTitles(db, args.dryRun)
  process.stdout.write(`${JSON.stringify({ dryRun: args.dryRun, summary }, null, 2)}\n`)
}

const entryFilePath = process.argv[1]
const moduleFilePath = fileURLToPath(import.meta.url)

if (entryFilePath && entryFilePath === moduleFilePath) {
  run()
    .catch((error) => {
      process.stderr.write(`Hebrew title backfill failed: ${String(error)}\n`)
      process.exit(1)
    })
    .finally(async () => {
      const { db } = await import('~/server/db')
      await db.$disconnect()
    })
}
