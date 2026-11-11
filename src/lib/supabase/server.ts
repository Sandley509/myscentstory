import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServiceRoleKey, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * Session-aware client for the admin. Uses the logged-in staff member's JWT,
 * so every query is checked by RLS (`is_staff()`).
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      }
    }
  });
}

let publicClient: SupabaseClient | null = null;

/** Anonymous client for storefront catalog reads (RLS: active products only). */
export function createPublicClient(): SupabaseClient {
  if (!publicClient) {
    publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return publicClient;
}

let serviceClient: SupabaseClient | null = null;

/**
 * Service-role client — bypasses RLS. Only for server code that must touch
 * carts/orders on behalf of an anonymous shopper (cart, checkout, webhook).
 */
export function createServiceClient(): SupabaseClient {
  const key = getServiceRoleKey();
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env (server only) and restart.'
    );
  }
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return serviceClient;
}
