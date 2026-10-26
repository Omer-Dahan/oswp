import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'

import NavLinks from '~/app/_components/nav-links'

const mockUsePathname = usePathname as jest.Mock

describe('NavLinks', () => {
  it('should show vendors in the top navigation', () => {
    mockUsePathname.mockReturnValue('/dashboard')

    render(<NavLinks />)

    expect(screen.getByRole('link', { name: 'לוח בקרה' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'רשימת אורחים' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'אירועים' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ספקים' })).toBeInTheDocument()
  })

  it('should mark vendors as active on vendors pages', () => {
    mockUsePathname.mockReturnValue('/vendors')

    render(<NavLinks />)

    const vendorsLink = screen.getByRole('link', { name: 'ספקים' })
    expect(vendorsLink).toHaveClass('border-primary')
  })
})
