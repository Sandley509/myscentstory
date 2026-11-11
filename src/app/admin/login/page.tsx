import { supabaseConfigured } from '@/lib/supabase/env';
import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a] bg-[radial-gradient(ellipse_at_top,#2f5ae033,transparent_60%)] p-4">
      <div className="admin-card w-full max-w-[400px] p-8">
        {supabaseConfigured ? (
          <LoginForm />
        ) : (
          <div>
            <h1 className="text-[20px] font-bold">Connect Supabase first</h1>
            <p className="mt-2 text-admin-subdued">
              Add <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{' '}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> to <code>.env</code>, run the SQL in{' '}
              <code>supabase/migrations</code>, then restart the dev server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
