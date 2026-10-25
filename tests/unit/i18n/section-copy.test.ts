import { SECTION_COPY } from '~/i18n/section-copy'
import { WebsiteSectionType } from '~/server/domains/website-section/website-section.types'

describe('SECTION_COPY', () => {
  const types = Object.values(WebsiteSectionType)

  it.each(types)('has a non-empty Hebrew label and description for %s', (type) => {
    const entry = SECTION_COPY.he[type]
    expect(entry.label.trim().length).toBeGreaterThan(0)
    expect(entry.description.trim().length).toBeGreaterThan(0)
  })

  it.each(types)('has a Hebrew value different from the English one for %s', (type) => {
    const heEntry = SECTION_COPY.he[type]
    const enEntry = SECTION_COPY.en[type]
    expect(heEntry.label).not.toBe(enEntry.label)
    expect(heEntry.description).not.toBe(enEntry.description)
  })
})
