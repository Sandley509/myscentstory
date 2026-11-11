'use client';

import { Modal, SaveBar, Toast } from '@/components/admin/overlays';
import { Badge, Banner, Button, Card, CardSection, Checkbox, Field, Page, Select, TextInput } from '@/components/admin/ui';
import { addStaff, removeStaff, saveSettings, type SettingsInput } from '@/lib/admin/actions/settings';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

type Staff = { user_id: string; email: string; name: string | null; role: 'owner' | 'staff' };

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-admin-border py-6 first:pt-0 last:border-b-0 md:grid-cols-[280px_1fr]">
      <div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <p className="mt-1 text-admin-subdued">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function SettingsForm({
  initial,
  staff,
  isOwner,
  currentUserId,
  health
}: {
  initial: SettingsInput;
  staff: Staff[];
  isOwner: boolean;
  currentUserId: string;
  health: { label: string; ok: boolean; hint: string }[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [s, setS] = useState(initial);
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: '', name: '', password: '', role: 'staff' as 'owner' | 'staff' });
  const dirty = useMemo(() => JSON.stringify(s) !== JSON.stringify(saved), [s, saved]);
  const set = <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) => setS((x) => ({ ...x, [k]: v }));
  const setAddr = (k: keyof SettingsInput['address'], v: string) => setS((x) => ({ ...x, address: { ...x.address, [k]: v } }));

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveSettings(s);
      if (!res.ok) return setError(res.error);
      setSaved(s);
      setToast({ msg: 'Settings saved' });
      router.refresh();
    });

  return (
    <Page title="Settings">
      <SaveBar visible={dirty} saving={saving} onSave={save} onDiscard={() => setS(saved)} />
      {error && (
        <div className="mb-4">
          <Banner tone="critical">{error}</Banner>
        </div>
      )}

      <Section title="Store details" description="Shown to customers on receipts and your storefront.">
        <Card>
          <div className="flex flex-col gap-4">
            <Field label="Store name">
              <TextInput value={s.store_name} onChange={(e) => set('store_name', e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Store contact email">
                <TextInput type="email" value={s.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
              </Field>
              <Field label="Store phone">
                <TextInput value={s.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>
        <Card title="Business address">
          <div className="flex flex-col gap-4">
            <Field label="Address">
              <TextInput value={s.address.line1 ?? ''} onChange={(e) => setAddr('line1', e.target.value)} />
            </Field>
            <Field label="Apartment, suite, etc.">
              <TextInput value={s.address.line2 ?? ''} onChange={(e) => setAddr('line2', e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="City">
                <TextInput value={s.address.city ?? ''} onChange={(e) => setAddr('city', e.target.value)} />
              </Field>
              <Field label="Province / State">
                <TextInput value={s.address.state ?? ''} onChange={(e) => setAddr('state', e.target.value)} />
              </Field>
              <Field label="Postal code">
                <TextInput value={s.address.postal_code ?? ''} onChange={(e) => setAddr('postal_code', e.target.value)} />
              </Field>
            </div>
            <Field label="Country">
              <Select value={s.address.country ?? 'CA'} onChange={(e) => setAddr('country', e.target.value)}>
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </Select>
            </Field>
          </div>
        </Card>
      </Section>

      <Section title="Currency" description="The currency your products are priced and charged in.">
        <Card>
          <Field label="Store currency" helpText="Changing this doesn’t convert existing prices.">
            <Select value={s.currency} onChange={(e) => set('currency', e.target.value as 'CAD' | 'USD')}>
              <option value="CAD">Canadian Dollar (CAD $)</option>
              <option value="USD">US Dollar (USD $)</option>
            </Select>
          </Field>
        </Card>
      </Section>

      <Section title="Shipping and delivery" description="Charged at Stripe Checkout.">
        <Card>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Flat delivery rate">
                <TextInput prefix="$" inputMode="decimal" value={s.shipping_flat_rate} onChange={(e) => set('shipping_flat_rate', e.target.value)} />
              </Field>
              <Field label="Free delivery over" helpText="Leave empty to never offer free delivery.">
                <TextInput prefix="$" inputMode="decimal" value={s.free_shipping_threshold} onChange={(e) => set('free_shipping_threshold', e.target.value)} />
              </Field>
            </div>
            <Field label="Where you ship">
              <div className="flex flex-col gap-2">
                <Checkbox
                  label="Ship worldwide"
                  helpText="Every country Stripe Checkout supports."
                  checked={s.allowed_countries.includes('WORLD')}
                  onChange={(e) => set('allowed_countries', e.target.checked ? ['WORLD'] : ['CA', 'US'])}
                />
                {!s.allowed_countries.includes('WORLD') && (
                  <div className="flex gap-6 pl-6">
                    {[
                      ['CA', 'Canada'],
                      ['US', 'United States']
                    ].map(([code, label]) => (
                      <Checkbox
                        key={code}
                        label={label}
                        checked={s.allowed_countries.includes(code!)}
                        onChange={(e) =>
                          set(
                            'allowed_countries',
                            e.target.checked ? [...s.allowed_countries, code!] : s.allowed_countries.filter((c) => c !== code)
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>
        </Card>
      </Section>

      <Section title="Taxes" description="GST/HST/QST in Canada and US sales tax.">
        <Card>
          <Checkbox
            label="Calculate taxes automatically with Stripe Tax"
            helpText="Turn on Stripe Tax and add your registrations in the Stripe dashboard first, otherwise checkout will fail."
            checked={s.stripe_automatic_tax}
            onChange={(e) => set('stripe_automatic_tax', e.target.checked)}
          />
        </Card>
      </Section>

      <Section title="Users and permissions" description="People who can log in to this admin.">
        <Card
          flush
          title="Staff"
          actions={isOwner && <Button size="slim" onClick={() => setAddOpen(true)}>Add staff</Button>}
        >
          <div className="mt-3">
            {staff.map((m) => (
              <CardSection key={m.user_id} className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{m.name || m.email}</div>
                  <div className="text-admin-subdued">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={m.role === 'owner' ? 'info' : 'default'}>{m.role === 'owner' ? 'Store owner' : 'Staff'}</Badge>
                  {isOwner && m.user_id !== currentUserId && (
                    <Button
                      size="slim"
                      variant="tertiary"
                      onClick={() =>
                        window.confirm(`Remove ${m.email}?`) &&
                        start(async () => {
                          const res = await removeStaff(m.user_id);
                          setToast(res.ok ? { msg: 'Staff removed' } : { msg: res.error, error: true });
                          router.refresh();
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </CardSection>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Integrations" description="Environment variables this backend relies on.">
        <Card>
          <ul className="flex flex-col gap-2">
            {health.map((h) => (
              <li key={h.label} className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{h.label}</div>
                  {!h.ok && <div className="text-admin-subdued">{h.hint}</div>}
                </div>
                {h.ok ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Missing</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Modal
        open={addOpen}
        title="Add staff"
        onClose={() => setAddOpen(false)}
        primaryAction={
          <Button
            variant="primary"
            disabled={saving}
            onClick={() =>
              start(async () => {
                const res = await addStaff(newStaff);
                if (res.ok) {
                  setAddOpen(false);
                  setNewStaff({ email: '', name: '', password: '', role: 'staff' });
                  setToast({ msg: 'Staff added' });
                  router.refresh();
                } else setToast({ msg: res.error, error: true });
              })
            }
          >
            Add staff
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <TextInput value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} />
          </Field>
          <Field label="Temporary password" helpText="Share it privately; they can change it under Your account.">
            <TextInput value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as 'owner' | 'staff' })}>
              <option value="staff">Staff — full store access</option>
              <option value="owner">Owner — can also manage staff</option>
            </Select>
          </Field>
        </div>
      </Modal>
      <Toast message={toast?.msg ?? null} error={toast?.error} onDone={() => setToast(null)} />
    </Page>
  );
}
