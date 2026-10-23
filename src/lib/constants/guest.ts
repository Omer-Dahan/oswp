export const TAG_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
] as const

export const pickRandomTagColor = () =>
  TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)] ?? TAG_COLORS[0]

export const MAX_TAGS_PER_GUEST = 10

export const AGE_GROUP_OPTIONS = [
  { value: 'INFANT', label: 'תינוק (0-2 שנים)' },
  { value: 'CHILD', label: 'ילד (3-12 שנים)' },
  { value: 'TEEN', label: 'נער (13-17 שנים)' },
  { value: 'ADULT', label: 'בוגר (18+ שנים)' },
] as const
