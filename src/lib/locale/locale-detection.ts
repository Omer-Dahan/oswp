export const SPANISH_COUNTRY_CODES = new Set([
  'MX',
  'ES',
  'AR',
  'CO',
  'CL',
  'PE',
  'VE',
  'EC',
  'BO',
  'PY',
  'UY',
  'GT',
  'SV',
  'HN',
  'NI',
  'CR',
  'PA',
  'CU',
  'DO',
  'PR',
  'GQ',
])

export const LOCALES = ['en', 'es', 'he'] as const

export type Locale = (typeof LOCALES)[number]

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale)
}

export function getLocaleFromCountry(countryCode: string | null | undefined): Locale {
  if (!countryCode) return 'en'
  const code = countryCode.toUpperCase()
  if (code === 'IL') return 'he'
  return SPANISH_COUNTRY_CODES.has(code) ? 'es' : 'en'
}
