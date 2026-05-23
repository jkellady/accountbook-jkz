import { type Metadata } from 'next'
import { TaxPrepView } from '@/components/tax-position/TaxPrepView'

export const metadata: Metadata = {
  title: 'Tax Prep | Zentra Finance Cockpit',
  description: 'Prepare and export tax documents, summaries, and filing-ready reports.',
}

export default function TaxPrepRoute(): JSX.Element {
  return <TaxPrepView />
}
