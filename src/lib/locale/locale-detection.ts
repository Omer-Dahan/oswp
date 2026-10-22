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

export type Locale = 'en' | 'es' | 'he'

export function getLocaleFromCountry(countryCode: string | null | undefined): Locale {
  if (!countryCode) return 'en'
  const code = countryCode.toUpperCase()
  if (code === 'IL') return 'he'
  return SPANISH_COUNTRY_CODES.has(code) ? 'es' : 'en'
}
