const mockGetAllPublishedSlugs = jest.fn()

jest.mock('~/lib/blog/posts', () => ({
  getAllPublishedSlugs: () => mockGetAllPublishedSlugs(),
}))

describe('sitemap route', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    jest.resetModules()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    mockGetAllPublishedSlugs.mockReset()
    mockGetAllPublishedSlugs.mockReturnValue(['introducing-oswp', 'release-0-3-0'])
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })

  it('includes static marketing routes and published blog slugs', async () => {
    const { default: sitemap } = await import('~/app/sitemap')
    const entries = sitemap()

    const urls = entries.map((entry) => entry.url)

    expect(urls).toContain('http://localhost:3000/')
    expect(urls).toContain('http://localhost:3000/blog')
    expect(urls).toContain('http://localhost:3000/pricing')
    expect(urls).toContain('http://localhost:3000/open-source')
    expect(urls).toContain('http://localhost:3000/blog/introducing-oswp')
    expect(urls).toContain('http://localhost:3000/blog/release-0-3-0')
  })
})
