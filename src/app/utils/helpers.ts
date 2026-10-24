// format: January 1, 2024 (he: 1 בינואר 2024)
function formatDateStandard(date: Date | null | undefined, locale?: string) {
  if (!date) return
  return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-us', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// format: 01.24.2024
function formatDateNumber(date: Date | null | undefined) {
  if (!date) return
  const d = new Date(date)
  let month = `${d.getMonth() + 1}`
  let day = `${d.getDate()}`
  const year = d.getFullYear()

  if (month.length < 2) month = `0${month}`
  if (day.length < 2) day = `0${day}`

  return [month, day, year].join('.')
}

// format: 2024-01-24 - this is the accepted format for HTML5 input pattern
function formatDateHTML5(date: Date | null | undefined) {
  if (!date) return undefined
  const d = new Date(date)
  let month = `${d.getMonth() + 1}`
  let day = `${d.getDate()}`
  const year = d.getFullYear()

  if (month.length < 2) month = `0${month}`
  if (day.length < 2) day = `0${day}`

  return [year, month, day].join('-')
}

// format: Sunday, Jan. 1
function convertDate(date: Date | null) {
  if (!date) return date
  const day = date.getDay()
  const month = date.getMonth()
  const datee = date.getDate()

  const abbreviatedMonths = [
    'Jan.',
    'Feb.',
    'Mar.',
    'Apr.',
    'May',
    'Jun.',
    'Jul.',
    'Aug.',
    'Sep.',
    'Oct.',
    'Nov.',
    'Dec.',
  ]
  const daysOfTheWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]

  return `${daysOfTheWeek[day]}, ${abbreviatedMonths[month]} ${datee + 1}`
}

// The countdown is always shown in Israel time, so "today" must be today's
// calendar date in Asia/Jerusalem — not the server process's own timezone
// (which on most hosts is UTC and would be a day off for part of the day).
const COUNTDOWN_TIMEZONE = 'Asia/Jerusalem'

function calculateDaysRemaining(weddingDate: Date | null | undefined) {
  if (!weddingDate) return undefined

  const millisecondsPerDay = 24 * 60 * 60 * 1000

  // weddingDate is a date-only `@db.Date` column, stored as UTC midnight —
  // its UTC year/month/day is the intended calendar date.
  const weddingDateOnly = Date.UTC(
    weddingDate.getUTCFullYear(),
    weddingDate.getUTCMonth(),
    weddingDate.getUTCDate()
  )

  const jerusalemParts = new Intl.DateTimeFormat('en-US', {
    timeZone: COUNTDOWN_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date())
  const part = (type: 'year' | 'month' | 'day'): number =>
    Number(jerusalemParts.find((p) => p.type === type)?.value)
  const todayInJerusalem = Date.UTC(part('year'), part('month') - 1, part('day'))

  return Math.round((weddingDateOnly - todayInJerusalem) / millisecondsPerDay)
}

// returns an array of times from 12pm to 11:45am (24hrs) in 15min increments
function generateTimes() {
  const times = []
  for (let i = 720; i <= 2145; i += 15) {
    let hours: number | string = Math.floor(i / 60) % 24
    let minutes: number | string = i % 60
    if (minutes < 10) minutes = `0${minutes.toString()}`
    if (hours < 10) hours = `0${hours.toString()}`
    times.push(`${hours}:${minutes}`)
  }
  return times
}

const generateRandomColor = () => {
  return '#000000'.replace(/0/g, () => (~~(Math.random() * 16)).toString(16))
}

function debounce<T = unknown, R = void>(
  callback: (...args: unknown[]) => R,
  wait: number,
  context?: T,
  immediate?: boolean
) {
  let timeout: ReturnType<typeof setTimeout> | null

  return (...args: unknown[]) => {
    const later = () => {
      timeout = null

      if (!immediate) {
        callback.apply(context, args)
      }
    }
    const callNow = immediate && !timeout

    if (typeof timeout === 'number') {
      clearTimeout(timeout)
    }

    timeout = setTimeout(later, wait)

    if (callNow) {
      callback.apply(context, args)
    }
  }
}

const dataUrlToFile = (url: string, fileName: string) => {
  const [mediaType, data] = url.split(',')
  const mime = mediaType?.match(/:(.*?);/)?.[1]
  let n = data?.length ?? 0
  const arr = new Uint8Array(n)

  while (n--) {
    arr[n] = data?.charCodeAt(n) ?? 0
  }

  return new File([arr], fileName, { type: mime })
}

export {
  calculateDaysRemaining,
  convertDate,
  dataUrlToFile,
  debounce,
  formatDateHTML5,
  formatDateNumber,
  formatDateStandard,
  generateRandomColor,
  generateTimes,
}
