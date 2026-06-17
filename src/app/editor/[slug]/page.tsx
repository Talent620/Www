import { notFound } from 'next/navigation';
import { getProject } from '@/lib/store';
import { SiteEditor } from '@/components/SiteEditor';

export const dynamic = 'force-dynamic';

export default async function EditorPage({ params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) notFound();
  return <SiteEditor initialSpec={project.spec} slug={project.slug} />;
}
