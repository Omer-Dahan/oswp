import { fullEveningLabel } from '~/lib/wedding/evening-time'

const entry = (name: string, startTime: string, endTime: string) => ({ name, startTime, endTime })

describe('fullEveningLabel', () => {
  it('spans the whole evening, treating an after-midnight end as later', () => {
    expect(fullEveningLabel([entry('החופה', '19:30', '20:30'), entry('החתונה', '18:30', '00:30')])).toBe(
      '18:30–00:30'
    )
  })

  it('does not let a chuppah-only evening inherit the meal hours', () => {
    expect(fullEveningLabel([entry('החופה', '19:30', '20:30')])).toBe('19:30–20:30')
  })

  it('returns an empty label when the events carry no times', () => {
    expect(fullEveningLabel([{ name: 'x' }])).toBe('')
  })
})
