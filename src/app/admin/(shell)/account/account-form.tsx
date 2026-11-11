'use client';

import { Toast } from '@/components/admin/overlays';
import { Banner, Button, Card, Field, Page, TextInput } from '@/components/admin/ui';
import { updateAccount } from '@/lib/admin/actions/settings';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function AccountForm({ email, name: initialName }: { email: string; name: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Page title="Your account" narrow>
      <div className="flex max-w-xl flex-col gap-4">
        {error && <Banner tone="critical">{error}</Banner>}
        <Card title="Details">
          <div className="flex flex-col gap-4">
            <Field label="Email" helpText="Contact the store owner to change your login email.">
              <TextInput value={email} disabled />
            </Field>
            <Field label="Display name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
        </Card>
        <Card title="Change password">
          <div className="flex flex-col gap-4">
            <Field label="New password">
              <TextInput type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirm new password">
              <TextInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
        </Card>
        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => {
              setError(null);
              if (password && password !== confirm) return setError('Passwords don’t match.');
              start(async () => {
                const res = await updateAccount({ name, password });
                if (!res.ok) return setError(res.error);
                setPassword('');
                setConfirm('');
                setToast('Account updated');
                router.refresh();
              });
            }}
          >
            Save
          </Button>
        </div>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
