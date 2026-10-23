export const TASK_CATEGORIES = [
  'VENUE',
  'VENDORS',
  'ATTIRE',
  'STATIONERY',
  'GUESTS',
  'LEGAL',
  'CEREMONY',
  'RECEPTION',
  'BEAUTY',
  'HONEYMOON',
  'BUDGET',
  'OTHER',
] as const

export type TaskCategoryValue = (typeof TASK_CATEGORIES)[number]

export const TASK_CATEGORY_LABELS: Record<TaskCategoryValue, string> = {
  VENUE: 'אולם',
  VENDORS: 'ספק',
  ATTIRE: 'לבוש',
  STATIONERY: 'הדפסות',
  GUESTS: 'מוזמנים',
  LEGAL: 'עניינים משפטיים',
  CEREMONY: 'טקס',
  RECEPTION: 'קבלה',
  BEAUTY: 'יופי',
  HONEYMOON: 'ירח דבש',
  BUDGET: 'תקציב',
  OTHER: 'אחר',
}
