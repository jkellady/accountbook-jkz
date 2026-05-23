/**
 * Projects Page — Client Work Tracking.
 *
 * Lists all client projects with outstanding balance, status, and
 * receivables summary.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Projects',
}

export default function ProjectsRoute(): JSX.Element {
  return (
    <div className="app-container py-6">
      <div className="page-header">
        <h1>Projects</h1>
        <p>Track client work from quote to final payment</p>
      </div>
      <div className="card">
        <p className="text-sm text-grey">
          Project list component to be mounted here.
        </p>
      </div>
    </div>
  )
}
