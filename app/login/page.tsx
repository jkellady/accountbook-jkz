import { type Metadata } from 'next'
import { AuthForm } from '@/components/auth/AuthForm'

export const metadata: Metadata = {
  title: 'Sign In | Zentra Finance Cockpit',
  description: 'Sign in to your Zentra Finance Cockpit account.',
}

export default function LoginRoute(): JSX.Element {
  return <AuthForm />
}
