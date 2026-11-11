import { Breadcrumbs } from '@/components/store/breadcrumbs';
import { getStoreSettings } from '@/lib/commerce';
import { getStorePage, PAGE_SLUGS } from '@/lib/pages';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = () => PAGE_SLUGS.map((slug) => ({ slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getStorePage(slug, await getStoreSettings());
  if (!page) return { title: 'Not found' };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/pages/${slug}` },
    openGraph: { title: page.title, description: page.description, url: `/pages/${slug}` }
  };
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const page = getStorePage(slug, await getStoreSettings());
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs trail={[{ name: page.title, path: `/pages/${slug}` }]} />
      <h1 className="heading-caps mt-6 text-3xl">{page.title}</h1>
      {page.updated && <p className="mt-2 text-xs uppercase tracking-[0.1em] text-muted">Last updated {page.updated}</p>}
      <div className="prose-store prose-page mt-8 text-[15px] text-neutral-800">{page.body}</div>
    </div>
  );
}
