import { MilestoneCategory } from '@prisma/client'

export const MILESTONE_KEYS = [
  'date_set',
  'guest_list_drafted',
  'venue_booked',
  'photographer_booked',
  'caterer_booked',
  'florist_booked',
  'save_the_dates_sent',
  'invitations_sent',
  'rsvps_collected',
  'officiant_chosen',
  'marriage_license_obtained',
  'final_headcount_sent',
  'wedding_day',
] as const

export type CanonicalMilestoneKey = (typeof MILESTONE_KEYS)[number]

export type CanonicalMilestoneSeed = {
  key: CanonicalMilestoneKey
  title: string
  category: MilestoneCategory
  position: number
}

function freezeSeedEntry<const T extends CanonicalMilestoneSeed>(entry: T): Readonly<T> {
  return Object.freeze({ ...entry })
}

export const MILESTONE_SEED: ReadonlyArray<CanonicalMilestoneSeed> = Object.freeze([
  freezeSeedEntry({
    key: 'date_set',
    title: 'תאריך נקבע',
    category: MilestoneCategory.SETUP,
    position: 0,
  }),
  freezeSeedEntry({
    key: 'guest_list_drafted',
    title: 'רשימת מוזמנים נוסחה',
    category: MilestoneCategory.SETUP,
    position: 1,
  }),
  freezeSeedEntry({
    key: 'venue_booked',
    title: 'אולם הוזמן',
    category: MilestoneCategory.VENDORS,
    position: 2,
  }),
  freezeSeedEntry({
    key: 'photographer_booked',
    title: 'צלם/ת הוזמן/ה',
    category: MilestoneCategory.VENDORS,
    position: 3,
  }),
  freezeSeedEntry({
    key: 'caterer_booked',
    title: 'קייטרינג הוזמן',
    category: MilestoneCategory.VENDORS,
    position: 4,
  }),
  freezeSeedEntry({
    key: 'florist_booked',
    title: 'מעצב/ת פרחים הוזמן/ה',
    category: MilestoneCategory.VENDORS,
    position: 5,
  }),
  freezeSeedEntry({
    key: 'save_the_dates_sent',
    title: '"שמרו את התאריך" נשלחו',
    category: MilestoneCategory.INVITATIONS,
    position: 6,
  }),
  freezeSeedEntry({
    key: 'invitations_sent',
    title: 'הזמנות נשלחו',
    category: MilestoneCategory.INVITATIONS,
    position: 7,
  }),
  freezeSeedEntry({
    key: 'rsvps_collected',
    title: 'אישורי הגעה נאספו',
    category: MilestoneCategory.INVITATIONS,
    position: 8,
  }),
  freezeSeedEntry({
    key: 'officiant_chosen',
    title: 'מסדר/ת הטקס נבחר/ה',
    category: MilestoneCategory.LEGAL,
    position: 9,
  }),
  freezeSeedEntry({
    key: 'marriage_license_obtained',
    title: 'רישיון נישואין התקבל',
    category: MilestoneCategory.LEGAL,
    position: 10,
  }),
  freezeSeedEntry({
    key: 'final_headcount_sent',
    title: 'כמות סופית נשלחה לקייטרינג',
    category: MilestoneCategory.FINALE,
    position: 11,
  }),
  freezeSeedEntry({
    key: 'wedding_day',
    title: 'יום החתונה',
    category: MilestoneCategory.FINALE,
    position: 12,
  }),
])

export function getCanonicalMilestoneSeed(): CanonicalMilestoneSeed[] {
  return MILESTONE_SEED.map((milestone) => ({ ...milestone }))
}
