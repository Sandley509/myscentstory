'use client';

import { TagsInput } from '@/components/admin/inputs';
import { Modal, SaveBar, Toast } from '@/components/admin/overlays';
import { Banner, Button, Card, Checkbox, Field, Layout, Page, TextArea, TextInput } from '@/components/admin/ui';
import { deleteCustomer, saveCustomer } from '@/lib/admin/actions/customers';
import type { CustomerInput } from '@/lib/admin/types';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type ReactNode } from 'react';

export function CustomerForm({
  initial,
  title,
  subtitle,
  summary,
  orders,
  address
}: {
  initial: CustomerInput;
  title: string;
  subtitle?: string;
  summary?: ReactNode;
  orders?: ReactNode;
  address?: ReactNode;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [c, setC] = useState(initial);
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !initial.id;
  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(saved), [c, saved]);
  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) => setC((s) => ({ ...s, [k]: v }));

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveCustomer(c);
      if (!res.ok) return setError(res.error);
      if (isNew) {
        router.replace(`/admin/customers/${res.data.id}`);
        return;
      }
      setSaved(c);
      setToast('Customer saved');
      router.refresh();
    });

  return (
    <Page title={title} subtitle={subtitle} backHref="/admin/customers" narrow>
      <SaveBar
        visible={dirty || isNew}
        saving={saving}
        message={isNew ? 'Unsaved customer' : 'Unsaved changes'}
        onSave={save}
        onDiscard={isNew ? () => router.push('/admin/customers') : () => setC(saved)}
      />
      {error && (
        <div className="mb-4">
          <Banner tone="critical">{error}</Banner>
        </div>
      )}
      {summary}
      <Layout
        main={
          <>
            {orders}
            <Card title="Customer overview">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="First name">
                    <TextInput value={c.first_name} onChange={(e) => set('first_name', e.target.value)} />
                  </Field>
                  <Field label="Last name">
                    <TextInput value={c.last_name} onChange={(e) => set('last_name', e.target.value)} />
                  </Field>
                </div>
                <Field label="Email">
                  <TextInput type="email" value={c.email} onChange={(e) => set('email', e.target.value)} />
                </Field>
                <Field label="Phone number">
                  <TextInput type="tel" value={c.phone} onChange={(e) => set('phone', e.target.value)} />
                </Field>
                <Checkbox
                  label="Customer agreed to receive marketing emails"
                  helpText="Only ask for permission if the customer gave consent."
                  checked={c.accepts_marketing}
                  onChange={(e) => set('accepts_marketing', e.target.checked)}
                />
              </div>
            </Card>
          </>
        }
        aside={
          <>
            {address}
            <Card title="Notes">
              <TextArea rows={4} value={c.note} placeholder="Add a note about this customer" onChange={(e) => set('note', e.target.value)} />
            </Card>
            <Card title="Tags">
              <TagsInput value={c.tags} onChange={(t) => set('tags', t)} placeholder="e.g. VIP, wholesale" />
            </Card>
          </>
        }
      />
      {!isNew && (
        <div className="mt-6 border-t border-admin-border pt-4">
          <Button variant="critical" onClick={() => setConfirmDelete(true)}>
            Delete customer
          </Button>
        </div>
      )}
      <Modal
        open={confirmDelete}
        title={`Delete ${title}?`}
        onClose={() => setConfirmDelete(false)}
        primaryAction={
          <Button
            variant="critical"
            onClick={() =>
              start(async () => {
                const res = await deleteCustomer(initial.id!);
                if (res.ok) {
                  router.push('/admin/customers');
                  router.refresh();
                } else setError(res.error);
              })
            }
          >
            Delete customer
          </Button>
        }
      >
        Their past orders are kept, but will no longer be linked to a customer profile.
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
