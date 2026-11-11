import { breadcrumbJsonLd } from '@/lib/seo';
import Link from 'next/link';
import { JsonLd } from './json-ld';

export function Breadcrumbs({ trail }: { trail: { name: string; path: string }[] }) {
  const full = [{ name: 'Home', path: '/' }, ...trail];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(full)} />
      <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-[0.1em] text-muted">
        <ol className="flex flex-wrap items-center gap-x-2">
          {full.map((t, i) => (
            <li key={t.path} className="flex items-center gap-x-2">
              {i > 0 && <span aria-hidden>/</span>}
              {i === full.length - 1 ? (
                <span aria-current="page" className="text-fg">{t.name}</span>
              ) : (
                <Link href={t.path} className="hover:text-fg">{t.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
