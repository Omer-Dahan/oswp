/**
 * Section label/description copy for the website editor.
 *
 * `SECTION_CATALOG` (website-section.catalog.ts) carries only English copy
 * because it's shared data (defaults, ordering); the editor UI is
 * hardcoded-Hebrew and does not mount next-intl, so it resolves display
 * copy from this table instead of `useTranslations`.
 */

import type { WebsiteSectionType } from '~/server/domains/website-section/website-section.types'

type SectionCopyEntry = { label: string; description: string }
type SectionCopyTable = Record<WebsiteSectionType, SectionCopyEntry>

export const SECTION_COPY: Record<'he' | 'en' | 'es', SectionCopyTable> = {
  he: {
    HOME: {
      label: 'ברוכים הבאים',
      description: 'פתיח קצר שהאורחים רואים בראש האתר.',
    },
    OUR_STORY: {
      label: 'הסיפור שלנו',
      description: 'איך הכרתם, ההצעה, המסע המשותף שלכם.',
    },
    TIMELINE: {
      label: 'ציר זמן של הסיפור',
      description: 'מסע אופקי של אבני דרך — ההיכרות, ההצעה, החגיגה.',
    },
    DESTINATION: {
      label: 'היעד',
      description: 'כתבה על העיר והמקום שלכם, עם תמונה וקישור אופציונליים.',
    },
    EXPERIENCES: {
      label: 'חוויות נבחרות',
      description: 'שורת כרטיסי תמונה לטקס, לחגיגה ולרגעים נוספים.',
    },
    WEDDING_PARTY: {
      label: 'השושבינים',
      description: 'הציגו את האנשים שעומדים לצידכם.',
    },
    TRAVEL: {
      label: 'הגעה ואירוח',
      description: 'מלונות, הנחיות הגעה, שירותים והערות תנועה לאורחים.',
    },
    FAQ: {
      label: 'שאלות ותשובות',
      description: 'ענו על השאלות שהאורחים שואלים הכי הרבה.',
    },
    REGISTRY: {
      label: 'רשימת מתנות',
      description: 'קישור לרשימות המתנות וההעדפות שלכם.',
    },
    SAVE_THE_DATE: {
      label: 'דף "שמרו את התאריך"',
      description:
        'ניסוח אישי לדף "שמרו את התאריך" העומד בפני עצמו. הדליקו כדי לכתוב נוסח משלכם; כבוי משאיר את ברירת המחדל של התבנית.',
    },
    INVITATION: {
      label: 'דף ההזמנה',
      description:
        'ניסוח אישי לדף ההזמנה העומד בפני עצמו. הדליקו כדי לכתוב נוסח משלכם; כבוי משאיר את ברירת המחדל של התבנית.',
    },
  },
  en: {
    HOME: {
      label: 'Welcome',
      description: 'A short intro guests see at the top of your site.',
    },
    OUR_STORY: {
      label: 'Our Story',
      description: 'How you met, the proposal, your journey together.',
    },
    TIMELINE: {
      label: 'Story Timeline',
      description:
        'A horizontal journey of milestones — first meeting, the proposal, the celebration.',
    },
    DESTINATION: {
      label: 'The Destination',
      description: 'An editorial feature for your city and venue, with an optional image and link.',
    },
    EXPERIENCES: {
      label: 'Curated Experiences',
      description: 'A row of image cards for the ceremony, celebration, and other moments.',
    },
    WEDDING_PARTY: {
      label: 'Wedding Party',
      description: 'Introduce the people standing beside you.',
    },
    TRAVEL: {
      label: 'Travel & Stay',
      description: 'Hotels, directions, services, and getting-around notes for guests.',
    },
    FAQ: {
      label: 'FAQ',
      description: 'Answer the questions guests ask most.',
    },
    REGISTRY: {
      label: 'Registry',
      description: 'Link out to your registries and gift preferences.',
    },
    SAVE_THE_DATE: {
      label: 'Save the Date Page',
      description:
        'Personalize the wording on your standalone Save the Date page. Turn on to use your own copy; off keeps the template default.',
    },
    INVITATION: {
      label: 'Invitation Page',
      description:
        'Personalize the wording on your standalone Invitation page. Turn on to use your own copy; off keeps the template default.',
    },
  },
  es: {
    HOME: {
      label: 'Bienvenida',
      description: 'Una breve introducción que ven los invitados al principio de tu sitio.',
    },
    OUR_STORY: {
      label: 'Nuestra historia',
      description: 'Cómo se conocieron, la propuesta, su camino juntos.',
    },
    TIMELINE: {
      label: 'Cronología de la historia',
      description:
        'Un recorrido horizontal de hitos: el primer encuentro, la propuesta, la celebración.',
    },
    DESTINATION: {
      label: 'El destino',
      description:
        'Una presentación editorial de tu ciudad y lugar, con imagen y enlace opcionales.',
    },
    EXPERIENCES: {
      label: 'Experiencias destacadas',
      description: 'Una fila de tarjetas con imágenes de la ceremonia, la celebración y otros momentos.',
    },
    WEDDING_PARTY: {
      label: 'Cortejo nupcial',
      description: 'Presenta a las personas que estarán a tu lado.',
    },
    TRAVEL: {
      label: 'Viaje y hospedaje',
      description: 'Hoteles, indicaciones, servicios y notas de traslado para los invitados.',
    },
    FAQ: {
      label: 'Preguntas frecuentes',
      description: 'Responde las preguntas más comunes de los invitados.',
    },
    REGISTRY: {
      label: 'Mesa de regalos',
      description: 'Enlaza tus mesas de regalos y preferencias de regalo.',
    },
    SAVE_THE_DATE: {
      label: 'Página de "Save the Date"',
      description:
        'Personaliza el texto de tu página independiente de "Save the Date". Activa para escribir tu propio texto; desactivado mantiene el predeterminado de la plantilla.',
    },
    INVITATION: {
      label: 'Página de invitación',
      description:
        'Personaliza el texto de tu página independiente de invitación. Activa para escribir tu propio texto; desactivado mantiene el predeterminado de la plantilla.',
    },
  },
}
