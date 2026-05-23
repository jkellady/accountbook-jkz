import { type Metadata } from 'next'
import { ProjectForm } from '@/components/projects/ProjectForm'

export const metadata: Metadata = {
  title: 'New Project | Zentra Finance Cockpit',
  description: 'Create a new project to track income, expenses, and profitability.',
}

export default function NewProjectRoute(): JSX.Element {
  return <ProjectForm />
}
