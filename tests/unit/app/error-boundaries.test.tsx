const mockCaptureException = jest.fn()

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    __loaded: true,
    captureException: (...args: unknown[]) => mockCaptureException(...args),
  },
}))

import { fireEvent, render, screen } from '@testing-library/react'

import AppErrorBoundary from '~/app/error'
import GlobalErrorBoundary from '~/app/global-error'

describe('App error boundary', () => {
  it('should render a recovery UI and allow retry', () => {
    const reset = jest.fn()

    render(<AppErrorBoundary error={new Error('Boom')} reset={reset} />)

    expect(screen.getByText('משהו השתבש')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'נסו שוב' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })
})

describe('Global error boundary', () => {
  it('should render a fallback page with retry and reload actions', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const reset = jest.fn()

    render(<GlobalErrorBoundary error={new Error('Global Boom')} reset={reset} />)

    expect(screen.getByText('שגיאה לא צפויה באפליקציה')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'טעינה מחדש' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'נסו שוב' }))
    expect(reset).toHaveBeenCalledTimes(1)

    consoleErrorSpy.mockRestore()
  })
})

describe('error boundary exception reporting', () => {
  it('reports with the server digest so client and server errors can be joined', () => {
    const error = Object.assign(new Error('render failed'), { digest: 'digest-1' })
    render(<AppErrorBoundary error={error} reset={jest.fn()} />)

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      mechanism: 'react-error-boundary',
      digest: 'digest-1',
    })
  })

  it('omits the digest for client-only errors', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = new Error('client failed')
    render(<GlobalErrorBoundary error={error} reset={jest.fn()} />)

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      mechanism: 'react-error-boundary',
    })
    consoleErrorSpy.mockRestore()
  })
})
