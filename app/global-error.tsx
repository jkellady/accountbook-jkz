'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps): JSX.Element {
  useEffect(() => {
    // Log to console and optionally to an error tracking service
    console.error('Global error boundary caught:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-800 dark:bg-neutral-900">
          <h1 className="mb-2 text-3xl font-bold text-red-600 dark:text-red-400">
            Oops!
          </h1>
          <h2 className="mb-4 text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            A critical error occurred
          </h2>
          <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            {error.message || 'Something went wrong loading the application. Please try again.'}
          </p>
          {error.digest && (
            <p className="mb-4 text-xs text-neutral-400 dark:text-neutral-500">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="inline-flex w-full items-center justify-center rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  )
}
