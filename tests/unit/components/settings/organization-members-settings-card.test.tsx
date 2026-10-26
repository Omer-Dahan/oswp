import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { OrganizationMembersSettingsCard } from '~/components/settings/organization-members-settings-card'

const mockFetch = jest.fn()

jest.mock('~/lib/auth-client', () => ({
  authClient: {
    $fetch: (...args: unknown[]) => mockFetch(...args),
  },
}))

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

jest.mock('~/trpc/react', () => ({
  api: {
    workspaceInvite: {
      listMembers: {
        useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
      },
    },
  },
}))

describe('OrganizationMembersSettingsCard', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('shows a loading state before organization data resolves', () => {
    mockFetch.mockImplementation(() => new Promise(() => undefined))

    render(<OrganizationMembersSettingsCard />)

    expect(screen.getByRole('status')).toHaveTextContent('טוען חברי ארגון...')
  })

  it('renders the active organization members once the requests succeed', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === '/organization/get-full-organization') {
        return Promise.resolve({
          data: {
            id: 'org-seed-shrek-fiona',
            members: [
              {
                id: 'member-fiona',
                role: 'member',
                user: { email: 'fiona@swamp.wed', name: 'Fiona Ogre' },
              },
              {
                id: 'member-shrek',
                role: 'owner',
                user: { email: 'shrek@swamp.wed', name: 'Shrek Ogre' },
              },
            ],
            name: 'Couple',
          },
          error: null,
        })
      }

      if (path === '/organization/has-permission') {
        return Promise.resolve({
          data: { success: true },
          error: null,
        })
      }

      throw new Error(`Unexpected fetch path: ${path}`)
    })

    render(<OrganizationMembersSettingsCard />)

    await waitFor(() => {
      expect(screen.getByText('Shrek Ogre')).toBeInTheDocument()
    })

    expect(screen.getByText('fiona@swamp.wed')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'עריכת תפקיד' })).toHaveLength(2)
  })

  it('hides role editing and removal without member:update', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === '/organization/get-full-organization') {
        return Promise.resolve({
          data: {
            id: 'org-seed-shrek-fiona',
            members: [
              {
                id: 'member-fiona',
                role: 'member',
                user: { email: 'fiona@swamp.wed', name: 'Fiona Ogre' },
              },
            ],
            name: 'Couple',
          },
          error: null,
        })
      }

      if (path === '/organization/has-permission') {
        return Promise.resolve({
          data: { success: false },
          error: null,
        })
      }

      throw new Error(`Unexpected fetch path: ${path}`)
    })

    render(<OrganizationMembersSettingsCard />)

    await waitFor(() => {
      expect(screen.getByText('Fiona Ogre')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'עריכת תפקיד' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/הסרת/)).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no members', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === '/organization/get-full-organization') {
        return Promise.resolve({
          data: {
            id: 'org-seed-shrek-fiona',
            members: [],
            name: 'Couple',
          },
          error: null,
        })
      }

      if (path === '/organization/has-permission') {
        return Promise.resolve({
          data: { success: true },
          error: null,
        })
      }

      throw new Error(`Unexpected fetch path: ${path}`)
    })

    render(<OrganizationMembersSettingsCard />)

    await waitFor(() => {
      expect(
        screen.getByText('אין עדיין משתתפים — צרו קישור הזמנה כדי להוסיף.')
      ).toBeInTheDocument()
    })
  })

  it('refreshes members when the refresh button is clicked', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === '/organization/get-full-organization') {
        return Promise.resolve({
          data: {
            id: 'org-seed-shrek-fiona',
            members: [
              {
                id: 'member-fiona',
                role: 'member',
                user: { email: 'fiona@swamp.wed', name: 'Fiona Ogre' },
              },
            ],
            name: 'Couple',
          },
          error: null,
        })
      }

      if (path === '/organization/has-permission') {
        return Promise.resolve({
          data: { success: true },
          error: null,
        })
      }

      throw new Error(`Unexpected fetch path: ${path}`)
    })

    render(<OrganizationMembersSettingsCard />)

    await waitFor(() => {
      expect(screen.getByText('Fiona Ogre')).toBeInTheDocument()
    })

    mockFetch.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'רענון' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/organization/get-full-organization')
    })
  })

  it('updates a member role through the edit dialog', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === '/organization/get-full-organization') {
        return Promise.resolve({
          data: {
            id: 'org-seed-shrek-fiona',
            members: [
              {
                id: 'member-fiona',
                role: 'member',
                user: { email: 'fiona@swamp.wed', name: 'Fiona Ogre' },
              },
            ],
            name: 'Couple',
          },
          error: null,
        })
      }

      if (path === '/organization/has-permission') {
        return Promise.resolve({
          data: { success: true },
          error: null,
        })
      }

      if (path === '/organization/update-member-role') {
        return Promise.resolve({
          data: { id: 'member-fiona', role: 'admin' },
          error: null,
        })
      }

      throw new Error(`Unexpected fetch path: ${path}`)
    })

    render(<OrganizationMembersSettingsCard />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'עריכת תפקיד' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'עריכת תפקיד' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'תפקיד חבר' }))
    fireEvent.click(screen.getByRole('option', { name: 'מנהל' }))
    fireEvent.click(screen.getByRole('button', { name: 'שמירת תפקיד' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/organization/update-member-role',
        expect.objectContaining({
          body: expect.objectContaining({
            memberId: 'member-fiona',
            organizationId: 'org-seed-shrek-fiona',
            role: 'admin',
          }),
          method: 'POST',
        })
      )
    })
  })

  it('requires typing מחיקה in a confirmation modal before removing a member', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === '/organization/get-full-organization') {
        return Promise.resolve({
          data: {
            id: 'org-seed-shrek-fiona',
            members: [
              {
                id: 'member-fiona',
                role: 'member',
                user: { email: 'fiona@swamp.wed', name: 'Fiona Ogre' },
              },
            ],
            name: 'Couple',
          },
          error: null,
        })
      }

      if (path === '/organization/has-permission') {
        return Promise.resolve({
          data: { success: true },
          error: null,
        })
      }

      if (path === '/organization/remove-member') {
        return Promise.resolve({
          data: {
            member: {
              id: 'member-fiona',
              organizationId: 'org-seed-shrek-fiona',
              role: 'member',
              userId: 'user-fiona',
            },
          },
          error: null,
        })
      }

      throw new Error(`Unexpected fetch path: ${path}`)
    })

    render(<OrganizationMembersSettingsCard />)

    await waitFor(() => {
      expect(screen.getByLabelText('הסרת Fiona Ogre')).toBeEnabled()
    })

    fireEvent.click(screen.getByLabelText('הסרת Fiona Ogre'))

    expect(screen.getByText('אישור הסרת חבר')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'הסרת חבר' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('אישור'), {
      target: { value: 'לא-מחיקה' },
    })
    expect(screen.getByRole('button', { name: 'הסרת חבר' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('אישור'), {
      target: { value: 'מחיקה' },
    })
    expect(screen.getByRole('button', { name: 'הסרת חבר' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'הסרת חבר' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/organization/remove-member',
        expect.objectContaining({
          body: expect.objectContaining({
            memberIdOrEmail: 'member-fiona',
            organizationId: 'org-seed-shrek-fiona',
          }),
          method: 'POST',
        })
      )
    })
  })
})
