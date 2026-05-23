/**
 * Subscriptions Page — Software Stack Tracking.
 *
 * Manages recurring SaaS subscriptions, billing cycles, and renewal
 * reminders. Powers the Stack Radar burn calculation.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscriptions',
}

export default function SubscriptionsRoute(): JSX.Element {
  return (
    <div className="app-container py-6">
      <div className="page-header">
        <h1>Subscriptions</h1>
        <p>Track your software stack and recurring charges</p>
      </div>
      <div className="card">
        <p className="text-sm text-grey">
          Subscription list component to be mounted here.
        </p>
      </div>
    </div>
  )
}
