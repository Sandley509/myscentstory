'use client';

import { MediaUploader } from '@/components/admin/inputs';
import { Modal, SaveBar, Toast } from '@/components/admin/overlays';
import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  Layout,
  Page,
  TextArea,
  TextInput,
  Thumbnail
} from '@/components/admin/ui';
import { deleteCollection, saveCollection } from '@/lib/admin/actions/collections';
import { slugify } from '@/lib/admin/format';
import type { CollectionInput } from '@/lib/admin/types';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from './icons';

type ProductOption = { id: string; title: string; image: string | null; status: string };

export function CollectionForm({ initial, products }: { initial: CollectionInput; products: ProductOption[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [c, setC] = useState(initial);
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !initial.id;
  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(saved), [c, saved]);
  const set = <K extends keyof CollectionInput>(k: K, v: CollectionInput[K]) => setC((s) => ({ ...s, [k]: v }));

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const matches = query.trim()
    ? products
        .filter((p) => !c.product_ids.includes(p.id) && p.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
    : [];

  const move = (i: number, dir: -1 | 1) => {
    const ids = [...c.product_ids];
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    set('product_ids', ids);
  };

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveCollection(c);
      if (!res.ok) return setError(res.error);
      if (isNew) {
        router.replace(`/admin/collections/${res.data.id}`);
        router.refresh();
        return;
      }
      setSaved(c);
      setToast('Collection saved');
      router.refresh();
    });

  return (
    <Page
      title={isNew ? 'Create collection' : saved.title}
      titleMeta={!isNew && !saved.published ? <Badge>Hidden</Badge> : undefined}
      backHref="/admin/collections"
      narrow
    >
      <SaveBar
        visible={dirty || isNew}
        saving={saving}
        message={isNew ? 'Unsaved collection' : 'Unsaved changes'}
        onSave={save}
        onDiscard={isNew ? () => router.push('/admin/collections') : () => setC(saved)}
      />
      {error && (
        <div className="mb-4">
          <Banner tone="critical">{error}</Banner>
        </div>
      )}
      <Layout
        main={
          <>
            <Card>
              <div className="flex flex-col gap-4">
                <Field label="Title">
                  <TextInput value={c.title} placeholder="e.g. Birthday bouquets" onChange={(e) => set('title', e.target.value)} />
                </Field>
                <Field label="Description">
                  <TextArea rows={4} value={c.description} onChange={(e) => set('description', e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card title="Products" flush>
              <div className="relative px-4 pb-3">
                <label className="flex h-8 items-center gap-2 rounded-lg border border-[#8a8a8a] bg-white px-2.5 focus-within:border-admin-focus">
                  <SearchIcon width={16} height={16} className="text-admin-subdued" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products to add"
                    className="w-full bg-transparent text-[13px] outline-none"
                  />
                </label>
                {matches.length > 0 && (
                  <div className="admin-card absolute inset-x-4 top-10 z-10 max-h-72 overflow-y-auto p-1">
                    {matches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          set('product_ids', [...c.product_ids, p.id]);
                          setQuery('');
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-admin-hover"
                      >
                        <Thumbnail src={p.image} size={32} />
                        <span className="flex-1 truncate">{p.title}</span>
                        {p.status !== 'active' && <Badge tone="info">{p.status}</Badge>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {c.product_ids.length === 0 ? (
                <p className="border-t border-admin-border px-4 py-8 text-center text-admin-subdued">
                  There are no products in this collection. Search to add some.
                </p>
              ) : (
                <ul className="border-t border-admin-border">
                  {c.product_ids.map((id, i) => {
                    const p = byId.get(id);
                    if (!p) return null;
                    return (
                      <li key={id} className="flex items-center gap-3 border-b border-admin-border px-4 py-2 last:border-b-0">
                        <span className="w-5 text-right text-admin-subdued">{i + 1}.</span>
                        <Thumbnail src={p.image} size={36} />
                        <span className="flex-1 truncate font-medium">{p.title}</span>
                        {p.status !== 'active' && <Badge tone="info">{p.status}</Badge>}
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 hover:bg-black/5 disabled:opacity-30" aria-label="Move up">
                          <ChevronUpIcon width={16} height={16} />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === c.product_ids.length - 1} className="rounded p-1 hover:bg-black/5 disabled:opacity-30" aria-label="Move down">
                          <ChevronDownIcon width={16} height={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => set('product_ids', c.product_ids.filter((x) => x !== id))}
                          className="rounded p-1 text-admin-subdued hover:bg-black/5"
                          aria-label="Remove from collection"
                        >
                          <XIcon width={16} height={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Search engine listing">
              <div className="flex flex-col gap-4">
                <Field label="Page title">
                  <TextInput value={c.seo_title} maxLength={70} placeholder={c.title} onChange={(e) => set('seo_title', e.target.value)} />
                </Field>
                <Field label="Meta description">
                  <TextArea value={c.seo_description} maxLength={160} onChange={(e) => set('seo_description', e.target.value)} />
                </Field>
                <Field label="URL handle" helpText={`Storefront URL: /search/${c.handle || slugify(c.title) || '…'}`}>
                  <TextInput value={c.handle} placeholder={slugify(c.title)} onChange={(e) => set('handle', e.target.value.toLowerCase())} />
                </Field>
              </div>
            </Card>
          </>
        }
        aside={
          <>
            <Card title="Publishing">
              <div className="flex flex-col gap-3">
                <Checkbox
                  label="Visible on online store"
                  checked={c.published}
                  onChange={(e) => set('published', e.target.checked)}
                />
                <Field label="Menu position" helpText="Lower numbers show first in the navigation.">
                  <TextInput type="number" value={c.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
                </Field>
              </div>
            </Card>
            <Card title="Image">
              <MediaUploader
                single
                folder="collections"
                value={c.image_url ? [{ url: c.image_url, alt: c.title, width: null, height: null }] : []}
                onChange={(items) => set('image_url', items[0]?.url ?? null)}
              />
            </Card>
          </>
        }
      />
      {!isNew && (
        <div className="mt-6 border-t border-admin-border pt-4">
          <Button variant="critical" onClick={() => setConfirmDelete(true)}>
            Delete collection
          </Button>
        </div>
      )}
      <Modal
        open={confirmDelete}
        title={`Delete ${saved.title}?`}
        onClose={() => setConfirmDelete(false)}
        primaryAction={
          <Button
            variant="critical"
            onClick={() =>
              start(async () => {
                const res = await deleteCollection(initial.id!);
                if (res.ok) {
                  router.push('/admin/collections');
                  router.refresh();
                } else setError(res.error);
              })
            }
          >
            Delete
          </Button>
        }
      >
        The products stay in your store; only the collection is removed.
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
