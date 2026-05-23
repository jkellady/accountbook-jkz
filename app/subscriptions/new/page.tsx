import { type Metadata } from 'next'
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm'

export const metadata: Metadata = {
  title: 'New Subscription | Zentra Finance Cockpit',
  description: 'Add a new recurring subscription to track.',
}

export default function NewSubscriptionRoute(): JSX.Element {
  return <SubscriptionForm />
}
