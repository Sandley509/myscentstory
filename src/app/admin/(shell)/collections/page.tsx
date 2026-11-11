import { CollectionsIcon } from '@/components/admin/icons';
import { ListSearch } from '@/components/admin/list-search';
import { Badge, ButtonLink, Card, EmptyState, Page, Thumbnail } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Collections' };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function CollectionsPage({ searchParams }: Props) {
  const { q = '' } = await searchParams;
  const { supabase } = await requireStaffPage();

  let query = supabase
    .from('collections')
    .select('id, title, handle, image_url, published, sort_order, collection_products(count)')
    .order('sort_order')
    .order('title');
  const term = q.replace(/[%,()]/g, ' ').trim();
  if (term) query = query.ilike('title', `%${term}%`);
  const { data } = await query;
  const rows = (data ?? []) as {
    id: string;
    title: string;
    handle: string;
    image_url: string | null;
    published: boolean;
    collection_products: { count: number }[];
  }[];

  const action = <ButtonLink href="/admin/collections/new" variant="primary">Create collection</ButtonLink>;

  return (
    <Page title="Collections" primaryAction={action}>
      <Card flush>
        {!rows.length && !q ? (
          <EmptyState icon={<CollectionsIcon width={48} height={48} />} heading="Group your products into collections" action={action}>
            Collections power the storefront menu and the “Shop by occasion” section — e.g. Birthday, Wedding, Bestsellers.
          </EmptyState>
        ) : (
          <>
            <ListSearch placeholder="Search collections" defaultValue={q} />
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Products</th>
                    <th>Storefront</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/collections/${c.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                          <Thumbnail src={c.image_url} />
                          {c.title}
                        </Link>
                      </td>
                      <td>{c.collection_products?.[0]?.count ?? 0}</td>
                      <td>{c.published ? <Badge tone="success">Visible</Badge> : <Badge>Hidden</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p className="px-4 py-10 text-center text-admin-subdued">No collections found</p>}
            </div>
          </>
        )}
      </Card>
    </Page>
  );
}
