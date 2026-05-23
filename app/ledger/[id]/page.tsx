import { type Metadata } from 'next'
import { LedgerList } from '@/components/ledger/LedgerList'

interface TransactionDetailRouteProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata(
  { params }: TransactionDetailRouteProps
): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Transaction ${id} | Ledger | Zentra Finance Cockpit`,
  }
}

export default async function TransactionDetailRoute({
  params,
}: TransactionDetailRouteProps): Promise<JSX.Element> {
  const { id } = await params
  // LedgerList in detail mode shows the selected transaction
  return <LedgerList selectedTransactionId={id} />
}
