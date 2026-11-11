import { getCollections, getProducts } from '@/lib/commerce';
import { PAGE_SLUGS } from '@/lib/pages';
import { absoluteUrl, siteUrl } from '@/lib/site';
import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();
  const routes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/collections/all`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...PAGE_SLUGS.map((slug) => ({ url: `${siteUrl}/pages/${slug}`, changeFrequency: 'yearly' as const, priority: 0.3 }))
  ];

  try {
    const [products, collections] = await Promise.all([getProducts({}), getCollections()]);
    return [
      ...routes,
      ...collections
        .filter((c) => c.handle)
        .map((c) => ({ url: `${siteUrl}${c.path}`, lastModified: c.updatedAt, changeFrequency: 'daily' as const, priority: 0.8 })),
      ...products.map((p) => ({
        url: `${siteUrl}/products/${p.handle}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        // Image sitemap entries get product photos into Google Images.
        images: p.images.map((i) => absoluteUrl(i.url)).slice(0, 10)
      }))
    ];
  } catch (e) {
    console.error('[sitemap]', e);
    return routes;
  }
}
