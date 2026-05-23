'use client'

import { useEffect } from 'react'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps): JSX.Element {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Route error caught by error boundary:', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/30">
      <h2 className="text-2xl font-semibold text-red-800 dark:text-red-200">
        Something went wrong
      </h2>
      <p className="max-w-md text-sm text-red-600 dark:text-red-400">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      {error.digest && (
        <p className="text-xs text-red-400 dark:text-red-500">
          Error ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-2 inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        Try again
      </button>
    </div>
  )
}
