export default function LoadingSkeleton(): JSX.Element {
  return (
    <div className="flex min-h-[60vh] animate-pulse flex-col gap-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-md bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-8 w-24 rounded-md bg-neutral-200 dark:bg-neutral-800" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="mb-2 h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-8 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Primary content area */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-2">
          <div className="mb-4 h-6 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div className="flex-1">
                  <div className="mb-1 h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
                  <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
                </div>
                <div className="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar area */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 h-6 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-neutral-200 dark:bg-neutral-800" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
