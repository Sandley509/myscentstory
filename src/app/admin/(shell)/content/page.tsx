import { ContentForm } from '@/components/admin/content-form';
import { requireStaffPage } from '@/lib/admin/auth';
import { toNumber } from '@/lib/commerce/pricing';
import { normalizeContent } from '@/lib/content';
import { SITE } from '@/lib/site';
import { formatPrice } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Online store' };

export default async function ContentPage() {
  const { supabase } = await requireStaffPage();
  const [{ data, error }, { data: collections }, { data: settings }] = await Promise.all([
    supabase.from('site_content').select('content').eq('id', 1).maybeSingle(),
    supabase.from('collections').select('handle, title').eq('published', true).order('sort_order').order('title'),
    supabase.from('store_settings').select('currency, free_shipping_threshold').eq('id', 1).maybeSingle()
  ]);

  const threshold = toNumber(settings?.free_shipping_threshold);
  const automaticAnnouncement =
    threshold > 0 ? `Free shipping on orders over ${formatPrice(threshold, settings?.currency ?? 'CAD')}` : SITE.tagline;

  return (
    <ContentForm
      initial={normalizeContent(data?.content)}
      // The table only exists once 0003_site_content.sql has been run.
      setupNeeded={Boolean(error)}
      automaticAnnouncement={automaticAnnouncement}
      linkOptions={[
        { label: 'All perfumes', value: '/collections/all' },
        { label: 'Best sellers', value: '/collections/all?sort=trending-desc' },
        { label: 'New arrivals', value: '/collections/all?sort=latest-desc' },
        ...((collections ?? []) as { handle: string; title: string }[]).map((c) => ({
          label: `Collection: ${c.title}`,
          value: `/collections/${c.handle}`
        })),
        { label: 'Shipping page', value: '/pages/shipping' },
        { label: 'Returns page', value: '/pages/returns' }
      ]}
    />
  );
}
