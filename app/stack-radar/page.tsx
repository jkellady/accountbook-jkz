import { type Metadata } from 'next'
import StackRadarView from '@/components/stack-radar/StackRadarView'

export const metadata: Metadata = {
  title: 'Stack Radar | Zentra Finance Cockpit',
  description: 'Monitor your tech stack spend, usage, and ROI across tools and services.',
}

export default function StackRadarRoute(): JSX.Element {
  return <StackRadarView />
}
