'use client';

import { Modal, SaveBar, Toast } from '@/components/admin/overlays';
import { Banner, Button, Card, Checkbox, Field, Layout, Page, Radio, TextInput } from '@/components/admin/ui';
import { deleteDiscount, saveDiscount } from '@/lib/admin/actions/discounts';
import type { DiscountInput } from '@/lib/admin/types';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

const randomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32])
    .join('');

/** ISO → value for <input type="datetime-local"> in the browser's timezone. */
const toLocalInput = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (local: string) => (local ? new Date(local).toISOString() : '');

export function DiscountForm({
  initial: initialIso,
  usageCount,
  currency
}: {
  /** `starts_at` / `ends_at` are ISO strings. */
  initial: DiscountInput;
  usageCount?: number;
  currency: string;
}) {
  const router = useRouter();
  const [initial] = useState(() => ({
    ...initialIso,
    starts_at: toLocalInput(initialIso.starts_at),
    ends_at: toLocalInput(initialIso.ends_at)
  }));
  const [saved, setSaved] = useState(initial);
  const [d, setD] = useState(initial);
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !initial.id;
  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(saved), [d, saved]);
  const set = <K extends keyof DiscountInput>(k: K, v: DiscountInput[K]) => setD((s) => ({ ...s, [k]: v }));

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveDiscount({ ...d, starts_at: fromLocalInput(d.starts_at), ends_at: fromLocalInput(d.ends_at) });
      if (!res.ok) return setError(res.error);
      if (isNew) {
        router.replace(`/admin/discounts/${res.data.id}`);
        return;
      }
      setSaved({ ...d, code: d.code.toUpperCase() });
      setD((x) => ({ ...x, code: x.code.toUpperCase() }));
      setToast('Discount saved');
      router.refresh();
    });

  const summary = [
    d.type === 'percentage' && d.value && `${d.value}% off entire order`,
    d.type === 'fixed_amount' && d.value && `${currency} ${Number(d.value).toFixed(2)} off entire order`,
    d.type === 'free_shipping' && 'Free shipping on entire order',
    d.min_subtotal && `Minimum purchase of ${currency} ${Number(d.min_subtotal).toFixed(2)}`,
    d.usage_limit ? `Limit of ${d.usage_limit} uses in total` : 'No usage limits',
    d.first_order_only && 'First order only',
    d.once_per_customer && 'One use per customer',
    d.ends_at ? `Active until ${new Date(d.ends_at).toLocaleDateString()}` : 'No end date'
  ].filter(Boolean) as string[];

  return (
    <Page title={isNew ? 'Create discount' : saved.code} backHref="/admin/discounts" narrow>
      <SaveBar
        visible={dirty || isNew}
        saving={saving}
        message={isNew ? 'Unsaved discount' : 'Unsaved changes'}
        onSave={save}
        onDiscard={isNew ? () => router.push('/admin/discounts') : () => setD(saved)}
      />
      {error && (
        <div className="mb-4">
          <Banner tone="critical">{error}</Banner>
        </div>
      )}
      <Layout
        main={
          <>
            <Card title="Discount code">
              <Field
                label="Code"
                labelAction={
                  <Button variant="plain" onClick={() => set('code', randomCode())}>
                    Generate random code
                  </Button>
                }
                helpText="Customers enter this code in the cart."
              >
                <TextInput value={d.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="e.g. SPRING15" />
              </Field>
            </Card>
            <Card title="Value">
              <div className="flex flex-col gap-3">
                <Radio name="type" label="Percentage" checked={d.type === 'percentage'} onChange={() => set('type', 'percentage')} />
                <Radio name="type" label="Fixed amount" checked={d.type === 'fixed_amount'} onChange={() => set('type', 'fixed_amount')} />
                <Radio name="type" label="Free shipping" checked={d.type === 'free_shipping'} onChange={() => set('type', 'free_shipping')} />
                {d.type !== 'free_shipping' && (
                  <div className="max-w-[220px]">
                    <TextInput
                      inputMode="decimal"
                      value={d.value}
                      onChange={(e) => set('value', e.target.value)}
                      prefix={d.type === 'fixed_amount' ? '$' : undefined}
                      suffix={d.type === 'percentage' ? '%' : undefined}
                    />
                  </div>
                )}
              </div>
            </Card>
            <Card title="Minimum purchase requirements">
              <Field label="Minimum purchase amount" helpText="Leave empty for no minimum.">
                <div className="max-w-[220px]">
                  <TextInput prefix="$" inputMode="decimal" value={d.min_subtotal} onChange={(e) => set('min_subtotal', e.target.value)} />
                </div>
              </Field>
            </Card>
            <Card title="Maximum discount uses">
              <div className="flex flex-col gap-4">
                <Field label="Limit number of times this discount can be used in total" helpText="Leave empty for unlimited.">
                  <div className="max-w-[220px]">
                    <TextInput type="number" min={1} value={d.usage_limit} onChange={(e) => set('usage_limit', e.target.value)} />
                  </div>
                </Field>
                <Checkbox
                  label="First order only"
                  helpText="Only for customers who have never ordered before. The shopper enters their email when applying the code, and checkout uses that email."
                  checked={d.first_order_only}
                  onChange={(e) => set('first_order_only', e.target.checked)}
                />
                <Checkbox
                  label="Limit to one use per customer"
                  helpText="Checked by email address."
                  checked={d.once_per_customer}
                  onChange={(e) => set('once_per_customer', e.target.checked)}
                />
              </div>
            </Card>
            <Card title="Active dates">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Start date">
                  <TextInput type="datetime-local" value={d.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
                </Field>
                <Field label="End date (optional)">
                  <TextInput type="datetime-local" value={d.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
                </Field>
              </div>
            </Card>
          </>
        }
        aside={
          <>
            <Card title="Summary">
              <p className="mb-2 font-semibold">{d.code || 'No discount code yet'}</p>
              <ul className="list-disc pl-5 text-admin-subdued">
                {summary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              {usageCount !== undefined && (
                <p className="mt-3 border-t border-admin-border pt-3">
                  Used {usageCount} time{usageCount === 1 ? '' : 's'}
                </p>
              )}
            </Card>
            <Card title="Status">
              <Checkbox label="Active" helpText="Turn off to pause the code." checked={d.active} onChange={(e) => set('active', e.target.checked)} />
            </Card>
          </>
        }
      />
      {!isNew && (
        <div className="mt-6 border-t border-admin-border pt-4">
          <Button variant="critical" onClick={() => setConfirmDelete(true)}>
            Delete discount
          </Button>
        </div>
      )}
      <Modal
        open={confirmDelete}
        title={`Delete ${saved.code}?`}
        onClose={() => setConfirmDelete(false)}
        primaryAction={
          <Button
            variant="critical"
            onClick={() =>
              start(async () => {
                const res = await deleteDiscount(initial.id!);
                if (res.ok) {
                  router.push('/admin/discounts');
                  router.refresh();
                } else setError(res.error);
              })
            }
          >
            Delete
          </Button>
        }
      >
        Customers won’t be able to use this code anymore.
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
