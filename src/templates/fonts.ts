/**
 * Wedding Template Fonts
 *
 * Each template plugin can pull in its own typefaces. Fonts are loaded once
 * here (next/font requires module-scope calls) and exposed as CSS variables so
 * a template's theme can reference them via `var(--tpl-...)`. Attaching the
 * generated `.variable` className to the template root makes the variable
 * available to every surface rendered inside it.
 */

import {
  Cormorant_Garamond,
  Crimson_Text,
  EB_Garamond,
  Great_Vibes,
  Jost,
  Mulish,
  Playfair_Display,
} from 'next/font/google'
import localFont from 'next/font/local'

/** Classic template — warm editorial serif (matches the original hardcoded site). */
export const classicSerif = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--tpl-classic-serif',
  display: 'swap',
})

/** Aurelia template — high-contrast display serif for headings. */
export const aureliaSerif = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--tpl-aurelia-serif',
  display: 'swap',
})

/** Aurelia template — clean geometric sans for body copy and navigation. */
export const aureliaSans = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--tpl-aurelia-sans',
  display: 'swap',
})

/**
 * Voyage template — high-contrast editorial display serif for headlines. Thin
 * elegant strokes with a romantic italic for emphasis.
 */
export const voyageDisplay = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--tpl-voyage-display',
  display: 'swap',
})

/** Voyage template — refined readable serif for body copy. */
export const voyageBody = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--tpl-voyage-body',
  display: 'swap',
})

/** Voyage template — refined humanist sans for nav, labels, and buttons. */
export const voyageSans = Mulish({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--tpl-voyage-sans',
  display: 'swap',
})

/** Voyage template — flowing calligraphy script for romantic flavour phrases. */
export const voyageScript = Great_Vibes({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--tpl-voyage-script',
  display: 'swap',
})

/**
 * Hebrew guest site — Frank Ruhl Libre (local .ttf, Hebrew + Latin, real
 * weights so headings render bold without browser synthesis). `hebrewSerif`
 * is the display face for headings (Bold), `hebrewSans` the reading face for
 * body copy and forms (Regular), and `hebrewAlt` the medium weight for
 * emphasis and buttons — all three swappable in one place without touching
 * any component.
 */
export const hebrewSerif = localFont({
  src: './fonts/FrankRuhlLibre-Bold.ttf',
  weight: '700',
  variable: '--tpl-hebrew-serif',
  display: 'swap',
})

export const hebrewSans = localFont({
  src: './fonts/FrankRuhlLibre-Regular.ttf',
  weight: '400',
  variable: '--tpl-hebrew-sans',
  display: 'swap',
})

export const hebrewAlt = localFont({
  src: './fonts/FrankRuhlLibre-Medium.ttf',
  weight: '500',
  variable: '--tpl-hebrew-alt',
  display: 'swap',
})

/** Light display face (BarLev AAA Light) — an airier alternative for large headings. */
export const hebrewLight = localFont({
  src: './fonts/BarLevAAA-Light.otf',
  weight: '300',
  variable: '--tpl-hebrew-light',
  display: 'swap',
})
