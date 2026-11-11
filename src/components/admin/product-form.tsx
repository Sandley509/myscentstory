'use client';

import { MediaUploader, RichTextEditor, TagsInput, type MediaItem } from '@/components/admin/inputs';
import { Modal, SaveBar, Toast } from '@/components/admin/overlays';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardSection,
  Checkbox,
  Field,
  Layout,
  Page,
  Select,
  TextArea,
  TextInput
} from '@/components/admin/ui';
import { deleteProducts, duplicateProduct, saveProduct } from '@/lib/admin/actions/products';
import { slugify } from '@/lib/admin/format';
import type { ProductInput, VariantInput } from '@/lib/admin/types';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { PlusIcon, TrashIcon, XIcon } from './icons';

const emptyVariant = (): VariantInput => ({
  option1: null,
  option2: null,
  option3: null,
  price: '0.00',
  compare_at_price: '',
  sku: '',
  barcode: '',
  inventory_quantity: 0,
  track_inventory: false,
  continue_selling: false
});

const keyOf = (v: Pick<VariantInput, 'option1' | 'option2' | 'option3'>) =>
  [v.option1, v.option2, v.option3].filter((x) => x !== null).join(' / ');

/** Cartesian product of option values, preserving data of variants that still exist. */
function buildVariants(options: ProductInput['options'], previous: VariantInput[]): VariantInput[] {
  const valid = options.filter((o) => o.name.trim() && o.values.some((v) => v.trim()));
  if (!valid.length) return [previous.find((v) => !v.option1) ?? previous[0] ?? emptyVariant()];

  let combos: (string | null)[][] = [[]];
  for (const o of valid) {
    const vals = o.values.map((v) => v.trim()).filter(Boolean);
    combos = combos.flatMap((c) => vals.map((v) => [...c, v]));
  }
  const byKey = new Map(previous.map((v) => [keyOf(v), v]));
  const template = previous[0] ?? emptyVariant();
  return combos.map((c) => {
    const [o1 = null, o2 = null, o3 = null] = c;
    const base = { option1: o1, option2: o2, option3: o3 };
    const existing = byKey.get(keyOf(base));
    return existing
      ? { ...existing, ...base }
      : { ...emptyVariant(), price: template.price, track_inventory: template.track_inventory, ...base };
  });
}

type CollectionOption = { id: string; title: string };

export function ProductForm({
  initial,
  collections,
  suggestions,
  storefrontUrl,
  currency
}: {
  initial: ProductInput;
  collections: CollectionOption[];
  suggestions: { types: string[]; vendors: string[]; tags: string[] };
  storefrontUrl?: string;
  currency: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [p, setP] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingOptions, setEditingOptions] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !initial.id;

  const dirty = useMemo(() => JSON.stringify(p) !== JSON.stringify(saved), [p, saved]);
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setP((s) => ({ ...s, [k]: v }));
  const hasOptions = p.options.some((o) => o.name.trim() && o.values.some(Boolean));
  const single = p.variants[0] ?? emptyVariant();

  const setSingle = (patch: Partial<VariantInput>) => set('variants', [{ ...single, ...patch }]);
  const setVariant = (i: number, patch: Partial<VariantInput>) =>
    set('variants', p.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)));

  const updateOptions = (options: ProductInput['options']) =>
    setP((s) => ({ ...s, options, variants: buildVariants(options, s.variants) }));

  const save = () => {
    setError(null);
    startSaving(async () => {
      const res = await saveProduct(p);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (isNew) {
        router.replace(`/admin/products/${res.data.id}`);
        router.refresh();
        return;
      }
      setSaved(p);
      setToast('Product saved');
      router.refresh();
    });
  };

  const seoTitle = p.seo_title || p.title || 'Product title';
  const seoDesc = p.seo_description || p.description_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const handle = p.handle || slugify(p.title);

  const statusBadge =
    !isNew &&
    (saved.status === 'active' ? (
      <Badge tone="success">Active</Badge>
    ) : saved.status === 'draft' ? (
      <Badge tone="info">Draft</Badge>
    ) : (
      <Badge>Archived</Badge>
    ));

  return (
    <Page
      title={isNew ? 'Add product' : saved.title || 'Untitled product'}
      titleMeta={statusBadge}
      backHref="/admin/products"
      narrow
      secondaryActions={
        !isNew && (
          <>
            <Button
              variant="tertiary"
              onClick={() =>
                startSaving(async () => {
                  const res = await duplicateProduct(initial.id!);
                  if (res.ok) router.push(`/admin/products/${res.data.id}`);
                  else setError(res.error);
                })
              }
            >
              Duplicate
            </Button>
            {storefrontUrl && saved.status === 'active' && (
              <a href={storefrontUrl} target="_blank" rel="noreferrer" className="admin-btn-secondary inline-flex h-8 items-center rounded-lg px-3 font-semibold">
                Preview
              </a>
            )}
          </>
        )
      }
    >
      <SaveBar
        visible={dirty || isNew}
        saving={saving}
        message={isNew ? 'Unsaved product' : 'Unsaved changes'}
        onSave={save}
        onDiscard={isNew ? () => router.push('/admin/products') : () => setP(saved)}
      />

      {error && (
        <div className="mb-4">
          <Banner tone="critical" title="There was a problem saving this product">{error}</Banner>
        </div>
      )}

      <Layout
        main={
          <>
            <Card>
              <div className="flex flex-col gap-4">
                <Field label="Title" htmlFor="title">
                  <TextInput id="title" value={p.title} placeholder="e.g. Velours Noir Eau de Parfum" onChange={(e) => set('title', e.target.value)} />
                </Field>
                <Field label="Description">
                  <RichTextEditor value={p.description_html} onChange={(v) => set('description_html', v)} />
                </Field>
              </div>
            </Card>

            <Card title="Media">
              <MediaUploader
                value={p.images as MediaItem[]}
                onChange={(images) => set('images', images)}
                folder={initial.id ?? 'new'}
              />
            </Card>

            {!hasOptions && (
              <>
                <Card title="Pricing">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Price" htmlFor="price">
                      <TextInput id="price" inputMode="decimal" prefix="$" value={single.price} onChange={(e) => setSingle({ price: e.target.value })} />
                    </Field>
                    <Field label="Compare-at price" htmlFor="cap" helpText="Shows the original price crossed out.">
                      <TextInput id="cap" inputMode="decimal" prefix="$" value={single.compare_at_price} onChange={(e) => setSingle({ compare_at_price: e.target.value })} />
                    </Field>
                  </div>
                  <p className="mt-3 text-admin-subdued">Prices are in {currency}. Taxes are calculated at checkout.</p>
                </Card>

                <Card title="Inventory">
                  <div className="flex flex-col gap-4">
                    <Checkbox
                      label="Track quantity"
                      checked={single.track_inventory}
                      onChange={(e) => setSingle({ track_inventory: e.target.checked })}
                    />
                    {single.track_inventory && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Quantity" htmlFor="qty">
                          <TextInput id="qty" type="number" value={single.inventory_quantity} onChange={(e) => setSingle({ inventory_quantity: Number(e.target.value) })} />
                        </Field>
                        <div className="sm:pt-6">
                          <Checkbox
                            label="Continue selling when out of stock"
                            checked={single.continue_selling}
                            onChange={(e) => setSingle({ continue_selling: e.target.checked })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="SKU (Stock Keeping Unit)" htmlFor="sku">
                        <TextInput id="sku" value={single.sku} onChange={(e) => setSingle({ sku: e.target.value })} />
                      </Field>
                      <Field label="Barcode (UPC, EAN, GTIN)" htmlFor="barcode" helpText="From the box. Google and Meta use it to match the perfume.">
                        <TextInput id="barcode" inputMode="numeric" value={single.barcode} onChange={(e) => setSingle({ barcode: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                </Card>
              </>
            )}

            <Card title="Variants" flush>
              {!hasOptions && !editingOptions ? (
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOptions(true);
                      updateOptions([{ name: 'Size', values: [] }]);
                    }}
                    className="flex items-center gap-1 font-medium text-admin-link hover:underline"
                  >
                    <PlusIcon width={16} height={16} /> Add options like size or colour
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col">
                    {p.options.map((o, oi) => (
                      <CardSection key={oi}>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-end gap-2">
                            <Field label="Option name">
                              <TextInput
                                value={o.name}
                                placeholder="Size"
                                onChange={(e) =>
                                  updateOptions(p.options.map((x, k) => (k === oi ? { ...x, name: e.target.value } : x)))
                                }
                              />
                            </Field>
                            <Button
                              variant="tertiary"
                              aria-label="Delete option"
                              onClick={() => updateOptions(p.options.filter((_, k) => k !== oi))}
                            >
                              <TrashIcon width={16} height={16} />
                            </Button>
                          </div>
                          <Field label="Option values">
                            <div className="flex flex-col gap-2">
                              {[...o.values, ''].map((val, vi) => (
                                <div key={vi} className="flex items-center gap-2">
                                  <TextInput
                                    value={val}
                                    placeholder={vi === o.values.length ? 'Add another value' : ''}
                                    onChange={(e) => {
                                      const values = [...o.values];
                                      if (vi === o.values.length) values.push(e.target.value);
                                      else values[vi] = e.target.value;
                                      updateOptions(p.options.map((x, k) => (k === oi ? { ...x, values } : x)));
                                    }}
                                  />
                                  {vi < o.values.length && (
                                    <button
                                      type="button"
                                      aria-label="Remove value"
                                      className="rounded-md p-1 text-admin-subdued hover:bg-black/5"
                                      onClick={() =>
                                        updateOptions(
                                          p.options.map((x, k) => (k === oi ? { ...x, values: x.values.filter((_, j) => j !== vi) } : x))
                                        )
                                      }
                                    >
                                      <XIcon width={16} height={16} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </Field>
                        </div>
                      </CardSection>
                    ))}
                    {p.options.length < 3 && (
                      <CardSection>
                        <button
                          type="button"
                          onClick={() => updateOptions([...p.options, { name: '', values: [] }])}
                          className="flex items-center gap-1 font-medium text-admin-link hover:underline"
                        >
                          <PlusIcon width={16} height={16} /> Add another option
                        </button>
                      </CardSection>
                    )}
                  </div>

                  {hasOptions && (
                    <div className="overflow-x-auto border-t border-admin-border">
                      <table className="admin-table w-full min-w-[690px] table-fixed [&_td]:px-2 [&_th]:px-2 [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
                        <thead>
                          <tr>
                            <th>Variant</th>
                            <th className="w-[104px]">Price</th>
                            <th className="w-[104px]">Compare-at</th>
                            <th className="w-[84px]">Available</th>
                            <th className="w-[52px] text-center">Track</th>
                            <th className="w-[100px]">SKU</th>
                            <th className="w-[130px] pr-4">Barcode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.variants.map((v, i) => (
                            <tr key={keyOf(v) || i}>
                              <td className="font-medium">{keyOf(v)}</td>
                              <td>
                                <TextInput prefix="$" inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
                              </td>
                              <td>
                                <TextInput prefix="$" inputMode="decimal" value={v.compare_at_price} onChange={(e) => setVariant(i, { compare_at_price: e.target.value })} />
                              </td>
                              <td>
                                <TextInput
                                  type="number"
                                  disabled={!v.track_inventory}
                                  value={v.track_inventory ? v.inventory_quantity : ''}
                                  placeholder="—"
                                  onChange={(e) => setVariant(i, { inventory_quantity: Number(e.target.value) })}
                                />
                              </td>
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  aria-label="Track quantity"
                                  className="h-4 w-4 accent-[#303030]"
                                  checked={v.track_inventory}
                                  onChange={(e) => setVariant(i, { track_inventory: e.target.checked })}
                                />
                              </td>
                              <td>
                                <TextInput value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} />
                              </td>
                              <td>
                                <TextInput inputMode="numeric" aria-label="Barcode" value={v.barcode} onChange={(e) => setVariant(i, { barcode: e.target.value })} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="px-4 py-3 text-admin-subdued">
                        Total inventory: {p.variants.filter((v) => v.track_inventory).reduce((s, v) => s + (v.inventory_quantity || 0), 0)} available
                      </p>
                    </div>
                  )}
                </>
              )}
            </Card>

            <Card title="Fragrance details">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="For">
                    <Select value={p.gender} onChange={(e) => set('gender', e.target.value as ProductInput['gender'])}>
                      <option value="">Not set</option>
                      <option value="female">Women</option>
                      <option value="male">Men</option>
                      <option value="unisex">Unisex</option>
                    </Select>
                  </Field>
                  <Field label="Concentration">
                    <TextInput list="concentrations" value={p.concentration} placeholder="Eau de Parfum" onChange={(e) => set('concentration', e.target.value)} />
                    <datalist id="concentrations">
                      {['Parfum', 'Eau de Parfum', 'Eau de Toilette', 'Eau de Cologne', 'Body Mist'].map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </Field>
                  <Field label="Scent family">
                    <TextInput list="scent-families" value={p.scent_family} placeholder="Woody" onChange={(e) => set('scent_family', e.target.value)} />
                    <datalist id="scent-families">
                      {['Floral', 'Woody', 'Amber', 'Fresh', 'Citrus', 'Fruity', 'Gourmand', 'Aromatic', 'Spicy', 'Leather'].map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </Field>
                </div>
                <Field label="Top notes">
                  <TagsInput value={p.top_notes} onChange={(t) => set('top_notes', t)} placeholder="e.g. Bergamot" />
                </Field>
                <Field label="Heart notes">
                  <TagsInput value={p.heart_notes} onChange={(t) => set('heart_notes', t)} placeholder="e.g. Jasmine" />
                </Field>
                <Field label="Base notes" helpText="Shown on the product page and used in search results and shopping feeds.">
                  <TagsInput value={p.base_notes} onChange={(t) => set('base_notes', t)} placeholder="e.g. Vanilla" />
                </Field>
              </div>
            </Card>

            <Card
              title="Search engine listing"
              actions={
                <Button variant="plain" onClick={() => setSeoOpen((o) => !o)}>
                  Edit
                </Button>
              }
            >
              <div className="text-[13px]">
                <p className="text-[#006621]">{storefrontUrl ? new URL(storefrontUrl).host : 'your-store'} › products › {handle || '…'}</p>
                <p className="truncate text-[17px] text-[#1a0dab]">{seoTitle}</p>
                <p className="line-clamp-2 text-admin-subdued">{seoDesc || 'Add a description to see how this product might appear in a search engine listing.'}</p>
              </div>
              {seoOpen && (
                <div className="mt-4 flex flex-col gap-4 border-t border-admin-border pt-4">
                  <Field label="Page title" helpText={`${p.seo_title.length} of 70 characters used`}>
                    <TextInput value={p.seo_title} maxLength={70} placeholder={p.title} onChange={(e) => set('seo_title', e.target.value)} />
                  </Field>
                  <Field label="Meta description" helpText={`${p.seo_description.length} of 160 characters used`}>
                    <TextArea value={p.seo_description} maxLength={160} onChange={(e) => set('seo_description', e.target.value)} />
                  </Field>
                  <Field label="URL handle">
                    <TextInput prefix="/" value={p.handle} placeholder={slugify(p.title)} onChange={(e) => set('handle', slugify(e.target.value) || e.target.value.toLowerCase())} />
                  </Field>
                </div>
              )}
            </Card>
          </>
        }
        aside={
          <>
            <Card title="Status">
              <Select value={p.status} onChange={(e) => set('status', e.target.value as ProductInput['status'])}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </Select>
              <p className="mt-2 text-admin-subdued">
                {p.status === 'active' ? 'Visible on your online store.' : 'Hidden from your online store.'}
              </p>
            </Card>

            <Card title="Product organization">
              <div className="flex flex-col gap-4">
                <Field label="Type">
                  <TextInput list="product-types" value={p.product_type} onChange={(e) => set('product_type', e.target.value)} placeholder="e.g. Perfume" />
                  <datalist id="product-types">{suggestions.types.map((t) => <option key={t} value={t} />)}</datalist>
                </Field>
                <Field label="Brand (vendor)">
                  <TextInput list="product-vendors" value={p.vendor} onChange={(e) => set('vendor', e.target.value)} />
                  <datalist id="product-vendors">{suggestions.vendors.map((t) => <option key={t} value={t} />)}</datalist>
                </Field>
                <Field label="Collections">
                  <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-lg border border-admin-border p-2">
                    {collections.length === 0 && <span className="text-admin-subdued">No collections yet</span>}
                    {collections.map((c) => (
                      <Checkbox
                        key={c.id}
                        label={c.title}
                        checked={p.collection_ids.includes(c.id)}
                        onChange={(e) =>
                          set(
                            'collection_ids',
                            e.target.checked ? [...p.collection_ids, c.id] : p.collection_ids.filter((x) => x !== c.id)
                          )
                        }
                      />
                    ))}
                  </div>
                </Field>
                <Field
                  label="Tags"
                  helpText="Tags are searchable and can switch on custom behaviour in your storefront code."
                >
                  <TagsInput value={p.tags} onChange={(t) => set('tags', t)} suggestions={suggestions.tags} />
                </Field>
              </div>
            </Card>
          </>
        }
      />

      {!isNew && (
        <div className="mt-6 flex justify-start border-t border-admin-border pt-4">
          <Button variant="critical" onClick={() => setConfirmDelete(true)}>
            Delete product
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
            disabled={saving}
            onClick={() =>
              startSaving(async () => {
                const res = await deleteProducts([initial.id!]);
                if (res.ok) {
                  router.push('/admin/products');
                  router.refresh();
                } else setError(res.error);
              })
            }
          >
            Delete product
          </Button>
        }
      >
        This can’t be undone. Past orders keep their line items.
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
