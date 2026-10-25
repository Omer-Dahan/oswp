import {
  buildWazeUrl,
  departByLabel,
  resolveWazeUrl,
  venueQuery,
} from '~/lib/website/maps'

describe('maps', () => {
  describe('buildWazeUrl', () => {
    it('encodes Hebrew and spaces in the query', () => {
      const url = buildWazeUrl('אגדתא אולם אירועים, צומת ראם, מסמיה')
      expect(url).toBe(
        'https://waze.com/ul?q=%D7%90%D7%92%D7%93%D7%AA%D7%90%20%D7%90%D7%95%D7%9C%D7%9D%20%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99%D7%9D%2C%20%D7%A6%D7%95%D7%9E%D7%AA%20%D7%A8%D7%90%D7%9D%2C%20%D7%9E%D7%A1%D7%9E%D7%99%D7%94&navigate=yes'
      )
    })
  })

  describe('venueQuery', () => {
    it('prefers the address over the venue name', () => {
      expect(
        venueQuery({
          venue: 'אגדתא',
          venueAddress: 'אגדתא אולם אירועים, צומת ראם, מסמיה',
          venueWazeUrl: null,
        })
      ).toBe('אגדתא אולם אירועים, צומת ראם, מסמיה')
    })

    it('falls back to the venue name when there is no address', () => {
      expect(venueQuery({ venue: 'אגדתא', venueAddress: null, venueWazeUrl: null })).toBe('אגדתא')
    })

    it('returns null when neither is set', () => {
      expect(venueQuery({ venue: null, venueAddress: '  ', venueWazeUrl: null })).toBeNull()
    })
  })

  describe('resolveWazeUrl', () => {
    it('prefers a valid stored waze.com/ul/... link', () => {
      expect(
        resolveWazeUrl({
          venue: 'אגדתא',
          venueAddress: null,
          venueWazeUrl: 'https://waze.com/ul/hsv8sxty41',
        })
      ).toBe('https://waze.com/ul/hsv8sxty41')
    })

    it('refuses a javascript: link and falls back to the address query', () => {
      expect(
        resolveWazeUrl({
          venue: null,
          venueAddress: 'אגדתא אולם אירועים, צומת ראם, מסמיה',
          venueWazeUrl: 'javascript:alert(1)',
        })
      ).toBe(buildWazeUrl('אגדתא אולם אירועים, צומת ראם, מסמיה'))
    })

    it('refuses a non-waze host and falls back to the address query', () => {
      expect(
        resolveWazeUrl({
          venue: null,
          venueAddress: 'אגדתא אולם אירועים, צומת ראם, מסמיה',
          venueWazeUrl: 'https://evil.com/ul/hsv8sxty41',
        })
      ).toBe(buildWazeUrl('אגדתא אולם אירועים, צומת ראם, מסמיה'))
    })

    it('returns null when there is neither a valid link nor a venue/address', () => {
      expect(resolveWazeUrl({ venue: null, venueAddress: null, venueWazeUrl: null })).toBeNull()
    })
  })

  describe('departByLabel', () => {
    it('renders "צאו לדרך עד 17:30" for an 18:00 start, 30 minutes before', () => {
      expect(departByLabel('18:00')).toBe('צאו לדרך עד 17:30')
    })

    it('returns null without a start time', () => {
      expect(departByLabel(null)).toBeNull()
      expect(departByLabel(undefined)).toBeNull()
    })
  })
})
