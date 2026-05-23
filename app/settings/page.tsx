import { type Metadata } from 'next'
import { SettingsPage } from '@/components/settings/SettingsPage'

export const metadata: Metadata = {
  title: 'Settings | Zentra Finance Cockpit',
  description: 'Manage your account preferences, integrations, notification rules, and team access.',
}

export default function SettingsRoute(): JSX.Element {
  return <SettingsPage />
}
