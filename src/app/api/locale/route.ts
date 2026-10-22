import { NextResponse } from 'next/server'
import { isLocale } from '~/lib/locale/locale-detection'

export async function POST(req: Request) {
  const body = (await req.json()) as { locale?: unknown }
  const locale = body.locale
  if (typeof locale !== 'string' || !isLocale(locale)) {
    return NextResponse.json({ error: 'invalid locale' }, { status: 400 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('lang-override', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: 'lax',
  })
  return res
}
