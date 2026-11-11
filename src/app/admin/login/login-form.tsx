'use client';

import { Button, Field, TextInput } from '@/components/admin/ui';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = params.get('next');
  const safeNext = next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await createBrowserSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message);
      setLoading(false);
      return;
    }
    router.replace(safeNext);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="mb-2 flex flex-col items-center text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-admin-top text-[18px] font-bold text-white">
          {(process.env.NEXT_PUBLIC_STORE_NAME || 'S').trim().charAt(0).toUpperCase()}
        </span>
        <h1 className="text-[20px] font-bold">Log in</h1>
        <p className="text-admin-subdued">Continue to your store admin</p>
      </div>
      <Field label="Email" htmlFor="email">
        <TextInput id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <TextInput
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && <p className="text-[13px] text-admin-critical" role="alert">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading} className="h-10 w-full">
        {loading ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
