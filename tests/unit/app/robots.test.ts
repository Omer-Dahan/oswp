describe('robots route', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    jest.resetModules()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    jest.resetModules()
  })

  it('points to app sitemap', async () => {
    const { default: robots } = await import('~/app/robots')
    const value = robots()

    expect(value.sitemap).toBe('http://localhost:3000/sitemap.xml')
    expect(value.rules).toEqual({
      userAgent: '*',
      allow: '/',
    })
  })
})
