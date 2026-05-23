import { type Metadata } from 'next'
import { ReviewQueue } from '@/components/review/ReviewQueue'

export const metadata: Metadata = {
  title: 'Review Queue | Zentra Finance Cockpit',
  description: 'Review, approve, or reject pending transactions and flagged items.',
}

export default function ReviewRoute(): JSX.Element {
  return <ReviewQueue />
}
