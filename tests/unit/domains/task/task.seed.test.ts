import { TaskCategory } from '@prisma/client'

import {
  type CanonicalTaskSeed,
  getCanonicalTaskSeed,
  TASK_SEED,
} from '~/server/domains/task/task.seed'

const EXPECTED_TASKS: ReadonlyArray<CanonicalTaskSeed> = [
  {
    seedKey: 'set_wedding_budget',
    position: 0,
    monthsBeforeWedding: 12,
    category: TaskCategory.BUDGET,
    title: 'קביעת תקציב החתונה',
  },
  {
    seedKey: 'decide_rough_guest_count',
    position: 1,
    monthsBeforeWedding: 12,
    category: TaskCategory.GUESTS,
    title: 'קביעת מספר מוזמנים משוער',
  },
  {
    seedKey: 'decide_ceremony_location_region',
    position: 2,
    monthsBeforeWedding: 12,
    category: TaskCategory.VENUE,
    title: 'קביעת אזור/מיקום לטקס',
  },
  {
    seedKey: 'tour_ceremony_venues',
    position: 3,
    monthsBeforeWedding: 12,
    category: TaskCategory.VENUE,
    title: 'סיור באולמות לטקס',
  },
  {
    seedKey: 'tour_reception_venues',
    position: 4,
    monthsBeforeWedding: 12,
    category: TaskCategory.VENUE,
    title: 'סיור באולמות לקבלה (אם נפרדים מהטקס)',
  },
  {
    seedKey: 'book_ceremony_venue',
    position: 5,
    monthsBeforeWedding: 12,
    category: TaskCategory.VENUE,
    title: 'הזמנת אולם לטקס',
    milestoneKey: 'venue_booked',
  },
  {
    seedKey: 'book_reception_venue',
    position: 6,
    monthsBeforeWedding: 12,
    category: TaskCategory.VENUE,
    title: 'הזמנת אולם לקבלה (אם נפרד)',
    milestoneKey: 'venue_booked',
  },
  {
    seedKey: 'hire_wedding_planner',
    position: 7,
    monthsBeforeWedding: 12,
    category: TaskCategory.VENDORS,
    title: 'שכירת מתכנן/ת חתונות (אופציונלי)',
  },
  {
    seedKey: 'decide_overall_vision_style',
    position: 8,
    monthsBeforeWedding: 12,
    category: TaskCategory.OTHER,
    title: 'קביעת חזון וסטייל כללי לחתונה',
  },
  {
    seedKey: 'start_attire_research',
    position: 9,
    monthsBeforeWedding: 12,
    category: TaskCategory.ATTIRE,
    title: 'התחלת חיפוש שמלת כלה / חליפת חתן',
  },
  {
    seedKey: 'finalize_guest_list_first_pass',
    position: 10,
    monthsBeforeWedding: 9,
    category: TaskCategory.GUESTS,
    title: 'סיום טיוטה ראשונית של רשימת המוזמנים',
    milestoneKey: 'guest_list_drafted',
  },
  {
    seedKey: 'book_photographer',
    position: 11,
    monthsBeforeWedding: 9,
    category: TaskCategory.VENDORS,
    title: 'הזמנת צלם/ת',
    milestoneKey: 'photographer_booked',
  },
  {
    seedKey: 'book_videographer',
    position: 12,
    monthsBeforeWedding: 9,
    category: TaskCategory.VENDORS,
    title: 'הזמנת צלם/ת וידאו (אופציונלי)',
  },
  {
    seedKey: 'book_caterer',
    position: 13,
    monthsBeforeWedding: 9,
    category: TaskCategory.VENDORS,
    title: 'הזמנת קייטרינג',
    milestoneKey: 'caterer_booked',
  },
  {
    seedKey: 'choose_officiant',
    position: 14,
    monthsBeforeWedding: 9,
    category: TaskCategory.CEREMONY,
    title: 'בחירת מסדר/ת הטקס',
    milestoneKey: 'officiant_chosen',
  },
  {
    seedKey: 'send_save_the_dates',
    position: 15,
    monthsBeforeWedding: 9,
    category: TaskCategory.STATIONERY,
    title: 'שליחת "שמרו את התאריך"',
    milestoneKey: 'save_the_dates_sent',
  },
  {
    seedKey: 'order_wedding_attire',
    position: 16,
    monthsBeforeWedding: 9,
    category: TaskCategory.ATTIRE,
    title: 'הזמנת/רכישת שמלת כלה או חליפת חתן',
  },
  {
    seedKey: 'book_dj_or_band',
    position: 17,
    monthsBeforeWedding: 9,
    category: TaskCategory.VENDORS,
    title: 'הזמנת תקליטן/ית או הרכב מוזיקלי',
  },
  {
    seedKey: 'set_up_wedding_website',
    position: 18,
    monthsBeforeWedding: 9,
    category: TaskCategory.OTHER,
    title: 'הקמת אתר אינטרנט לחתונה',
  },
  {
    seedKey: 'block_hotel_rooms',
    position: 19,
    monthsBeforeWedding: 9,
    category: TaskCategory.GUESTS,
    title: 'שמירת חדרי מלון למוזמנים מחוץ לעיר',
  },
  {
    seedKey: 'book_florist',
    position: 20,
    monthsBeforeWedding: 6,
    category: TaskCategory.VENDORS,
    title: 'הזמנת מעצב/ת פרחים',
    milestoneKey: 'florist_booked',
  },
  {
    seedKey: 'book_hair_makeup_artist',
    position: 21,
    monthsBeforeWedding: 6,
    category: TaskCategory.BEAUTY,
    title: 'הזמנת מעצב/ת שיער ואיפור',
  },
  {
    seedKey: 'choose_wedding_party',
    position: 22,
    monthsBeforeWedding: 6,
    category: TaskCategory.OTHER,
    title: 'בחירת שושבינים ושושבינות',
  },
  {
    seedKey: 'order_wedding_party_attire',
    position: 23,
    monthsBeforeWedding: 6,
    category: TaskCategory.ATTIRE,
    title: 'הזמנת לבוש לשושבינים',
  },
  {
    seedKey: 'plan_honeymoon',
    position: 24,
    monthsBeforeWedding: 6,
    category: TaskCategory.HONEYMOON,
    title: 'תכנון ירח הדבש',
  },
  {
    seedKey: 'choose_ceremony_readings_music',
    position: 25,
    monthsBeforeWedding: 6,
    category: TaskCategory.CEREMONY,
    title: 'בחירת קריאות ומוזיקה לטקס',
  },
  {
    seedKey: 'order_wedding_bands',
    position: 26,
    monthsBeforeWedding: 6,
    category: TaskCategory.OTHER,
    title: 'הזמנת טבעות נישואין',
  },
  {
    seedKey: 'decide_invitation_design',
    position: 27,
    monthsBeforeWedding: 6,
    category: TaskCategory.STATIONERY,
    title: 'בחירת עיצוב להזמנות',
  },
  {
    seedKey: 'order_stationery_suite',
    position: 28,
    monthsBeforeWedding: 6,
    category: TaskCategory.STATIONERY,
    title: 'הזמנת סט הדפסות מלא',
  },
  {
    seedKey: 'send_formal_invitations',
    position: 29,
    monthsBeforeWedding: 3,
    category: TaskCategory.STATIONERY,
    title: 'שליחת הזמנות רשמיות',
    milestoneKey: 'invitations_sent',
  },
  {
    seedKey: 'schedule_attire_fittings',
    position: 30,
    monthsBeforeWedding: 3,
    category: TaskCategory.ATTIRE,
    title: 'תיאום מדידות לשמלה / לחליפה',
  },
  {
    seedKey: 'write_vows',
    position: 31,
    monthsBeforeWedding: 3,
    category: TaskCategory.CEREMONY,
    title: 'כתיבת נדרים',
  },
  {
    seedKey: 'plan_rehearsal_dinner',
    position: 32,
    monthsBeforeWedding: 3,
    category: TaskCategory.RECEPTION,
    title: 'תכנון ארוחת חזרה גנרלית',
  },
  {
    seedKey: 'research_marriage_license_requirements',
    position: 33,
    monthsBeforeWedding: 3,
    category: TaskCategory.LEGAL,
    title: 'בדיקת דרישות רישום הנישואין',
  },
  {
    seedKey: 'confirm_vendor_details',
    position: 34,
    monthsBeforeWedding: 3,
    category: TaskCategory.VENDORS,
    title: 'אישור פרטים עם כל הספקים המוזמנים',
  },
  {
    seedKey: 'plan_ceremony_order_timing',
    position: 35,
    monthsBeforeWedding: 3,
    category: TaskCategory.CEREMONY,
    title: 'תכנון סדר ותזמון הטקס',
  },
  {
    seedKey: 'buy_wedding_rings',
    position: 36,
    monthsBeforeWedding: 3,
    category: TaskCategory.OTHER,
    title: 'רכישת טבעות נישואין (אם עדיין לא נעשה)',
  },
  {
    seedKey: 'collect_outstanding_rsvps',
    position: 37,
    monthsBeforeWedding: 1,
    category: TaskCategory.GUESTS,
    title: 'איסוף אישורי הגעה שחסרים',
    milestoneKey: 'rsvps_collected',
  },
  {
    seedKey: 'send_final_headcount_to_caterer',
    position: 38,
    monthsBeforeWedding: 1,
    category: TaskCategory.RECEPTION,
    title: 'שליחת כמות סופית לקייטרינג',
    milestoneKey: 'final_headcount_sent',
  },
  {
    seedKey: 'create_seating_chart',
    position: 39,
    monthsBeforeWedding: 1,
    category: TaskCategory.GUESTS,
    title: 'יצירת סידורי הושבה',
  },
  {
    seedKey: 'final_attire_fitting',
    position: 40,
    monthsBeforeWedding: 1,
    category: TaskCategory.ATTIRE,
    title: 'מדידה אחרונה לשמלה / לחליפה',
  },
  {
    seedKey: 'confirm_transportation_arrangements',
    position: 41,
    monthsBeforeWedding: 1,
    category: TaskCategory.OTHER,
    title: 'אישור סידורי הסעות',
  },
  {
    seedKey: 'confirm_honeymoon_details',
    position: 42,
    monthsBeforeWedding: 1,
    category: TaskCategory.HONEYMOON,
    title: 'אישור פרטי ירח הדבש',
  },
  {
    seedKey: 'get_marriage_license',
    position: 43,
    monthsBeforeWedding: 1,
    category: TaskCategory.LEGAL,
    title: 'קבלת רישיון נישואין',
    milestoneKey: 'marriage_license_obtained',
  },
  {
    seedKey: 'pay_remaining_vendor_balances',
    position: 44,
    monthsBeforeWedding: 1,
    category: TaskCategory.BUDGET,
    title: 'תשלום יתרות לספקים',
  },
  {
    seedKey: 'pack_for_honeymoon',
    position: 45,
    monthsBeforeWedding: 1,
    category: TaskCategory.HONEYMOON,
    title: 'אריזה לירח הדבש',
  },
  {
    seedKey: 'confirm_vendor_arrival_times',
    position: 46,
    monthsBeforeWedding: 0,
    category: TaskCategory.VENDORS,
    title: 'אישור שעות הגעה של הספקים',
  },
  {
    seedKey: 'provide_shot_list_to_photographer',
    position: 47,
    monthsBeforeWedding: 0,
    category: TaskCategory.VENDORS,
    title: 'מסירת רשימת צילומים לצלם/ת',
  },
  {
    seedKey: 'final_venue_walkthrough',
    position: 48,
    monthsBeforeWedding: 0,
    category: TaskCategory.VENUE,
    title: 'סיור אחרון באולם',
  },
  {
    seedKey: 'pick_up_wedding_rings',
    position: 49,
    monthsBeforeWedding: 0,
    category: TaskCategory.OTHER,
    title: 'איסוף טבעות הנישואין',
  },
  {
    seedKey: 'break_in_wedding_shoes',
    position: 50,
    monthsBeforeWedding: 0,
    category: TaskCategory.ATTIRE,
    title: 'הרגלת הרגליים לנעלי החתונה (אם חדשות)',
  },
  {
    seedKey: 'wedding_rehearsal',
    position: 51,
    monthsBeforeWedding: 0,
    category: TaskCategory.CEREMONY,
    title: 'חזרה גנרלית לחתונה',
  },
  {
    seedKey: 'rehearsal_dinner',
    position: 52,
    monthsBeforeWedding: 0,
    category: TaskCategory.RECEPTION,
    title: 'ארוחת חזרה גנרלית',
  },
  {
    seedKey: 'pack_overnight_bag',
    position: 53,
    monthsBeforeWedding: 0,
    category: TaskCategory.OTHER,
    title: 'אריזת תיק ללילה',
  },
  {
    seedKey: 'hair_and_makeup',
    position: 54,
    monthsBeforeWedding: 0,
    category: TaskCategory.BEAUTY,
    title: 'שיער ואיפור',
  },
  {
    seedKey: 'hand_off_rings_to_officiant',
    position: 55,
    monthsBeforeWedding: 0,
    category: TaskCategory.CEREMONY,
    title: 'מסירת הטבעות למסדר/ת הטקס',
  },
  {
    seedKey: 'enjoy_the_day',
    position: 56,
    monthsBeforeWedding: 0,
    category: TaskCategory.OTHER,
    title: 'הנאה מהיום',
  },
  {
    seedKey: 'send_thank_you_notes',
    position: 57,
    monthsBeforeWedding: -1,
    category: TaskCategory.GUESTS,
    title: 'שליחת מכתבי תודה',
  },
] as const

describe('task seed', () => {
  it('returns exactly 58 canonical tasks', () => {
    expect(getCanonicalTaskSeed()).toHaveLength(58)
    expect(TASK_SEED).toHaveLength(58)
  })

  it('matches the canonical task seed list from the approved design', () => {
    expect(getCanonicalTaskSeed()).toEqual(EXPECTED_TASKS)
    expect(TASK_SEED).toEqual(EXPECTED_TASKS)
  })

  it('has the expected category distribution and monthsBeforeWedding distribution', () => {
    const tasks = getCanonicalTaskSeed()

    const categoryDistribution = tasks.reduce<Record<TaskCategory, number>>(
      (distribution, task) => {
        distribution[task.category] = (distribution[task.category] ?? 0) + 1
        return distribution
      },
      {
        [TaskCategory.ATTIRE]: 0,
        [TaskCategory.BEAUTY]: 0,
        [TaskCategory.BUDGET]: 0,
        [TaskCategory.CEREMONY]: 0,
        [TaskCategory.GUESTS]: 0,
        [TaskCategory.HONEYMOON]: 0,
        [TaskCategory.LEGAL]: 0,
        [TaskCategory.OTHER]: 0,
        [TaskCategory.RECEPTION]: 0,
        [TaskCategory.STATIONERY]: 0,
        [TaskCategory.VENDORS]: 0,
        [TaskCategory.VENUE]: 0,
      }
    )

    const monthsDistribution = tasks.reduce<Record<number, number>>((distribution, task) => {
      distribution[task.monthsBeforeWedding] = (distribution[task.monthsBeforeWedding] ?? 0) + 1
      return distribution
    }, {})

    expect(categoryDistribution).toEqual({
      [TaskCategory.ATTIRE]: 6,
      [TaskCategory.BEAUTY]: 2,
      [TaskCategory.BUDGET]: 2,
      [TaskCategory.CEREMONY]: 6,
      [TaskCategory.GUESTS]: 6,
      [TaskCategory.HONEYMOON]: 3,
      [TaskCategory.LEGAL]: 2,
      [TaskCategory.OTHER]: 9,
      [TaskCategory.RECEPTION]: 3,
      [TaskCategory.STATIONERY]: 4,
      [TaskCategory.VENDORS]: 9,
      [TaskCategory.VENUE]: 6,
    })

    expect(monthsDistribution).toEqual({
      12: 10,
      9: 10,
      6: 9,
      3: 8,
      1: 9,
      0: 11,
      [-1]: 1,
    })
  })

  it('includes stable seed identity for every canonical default task', () => {
    const tasks = getCanonicalTaskSeed()

    expect(tasks.every((task) => task.seedKey.length > 0)).toBe(true)
    expect(new Set(tasks.map((task) => task.seedKey)).size).toBe(tasks.length)
  })

  it('returns safe copies and keeps the canonical task seed frozen', () => {
    const [canonicalTask] = TASK_SEED
    const [copiedTask] = getCanonicalTaskSeed()

    expect(Object.isFrozen(TASK_SEED)).toBe(true)
    expect(Object.isFrozen(canonicalTask)).toBe(true)

    expect(copiedTask).not.toBe(canonicalTask)
    copiedTask.title = 'Changed copy only'

    expect(getCanonicalTaskSeed()[0]?.title).toBe('קביעת תקציב החתונה')
    expect(TASK_SEED[0]?.title).toBe('קביעת תקציב החתונה')
  })
})
