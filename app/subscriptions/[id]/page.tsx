import { type Metadata } from 'next'
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm'

interface SubscriptionDetailRouteProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata(
  { params }: SubscriptionDetailRouteProps
): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Subscription ${id} | Subscriptions | Zentra Finance Cockpit`,
  }
}

export default async function SubscriptionDetailRoute({
  params,
}: SubscriptionDetailRouteProps): Promise<JSX.Element> {
  const { id } = await params
  return <SubscriptionForm subscriptionId={id} />
}
