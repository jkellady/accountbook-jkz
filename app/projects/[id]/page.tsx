import { type Metadata } from 'next'
import { ProjectDetail } from '@/components/projects/ProjectDetail'

interface ProjectDetailRouteProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata(
  { params }: ProjectDetailRouteProps
): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Project ${id} | Projects | Zentra Finance Cockpit`,
  }
}

export default async function ProjectDetailRoute({
  params,
}: ProjectDetailRouteProps): Promise<JSX.Element> {
  const { id } = await params
  return <ProjectDetail projectId={id} />
}
