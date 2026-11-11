import { isMaintenanceMode, PREVIEW_COOKIE, previewToken } from '@/lib/maintenance';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Paths that keep working during maintenance (besides /admin). */
const ALWAYS_OPEN = /^\/(api\/|maintenance$|_next\/)|\.[a-z0-9]{2,5}$/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin')) return admin(request);
  if (!isMaintenanceMode() || ALWAYS_OPEN.test(pathname)) return NextResponse.next();

  // Logged-in admins can still browse the store to check it before reopening.
  if (request.cookies.get(PREVIEW_COOKIE)?.value === (await previewToken())) {
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex');
    return res;
  }

  const res = NextResponse.rewrite(new URL('/maintenance', request.url), { status: 503 });
  res.headers.set('Retry-After', '3600');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/**
 * Protects /admin. Refreshes the Supabase session cookie on every admin
 * request and bounces anonymous visitors to /admin/login.
 *
 * The staff-role check (is this user in `staff`?) happens in the admin
 * layout and again in RLS — middleware only checks "is someone logged in".
 */
async function admin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const isLogin = request.nextUrl.pathname.startsWith('/admin/login');

  if (!url || !key) {
    // Not configured yet: let the login page explain what's missing.
    if (isLogin) return NextResponse.next();
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !isLogin) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Lets this admin browse the store while maintenance mode is on.
  if (user && isMaintenanceMode()) {
    const token = await previewToken();
    if (request.cookies.get(PREVIEW_COOKIE)?.value !== token) {
      response.cookies.set(PREVIEW_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 60 * 60 * 12 });
    }
  }

  return response;
}

export const config = {
  // Everything except Next's own build files, so maintenance mode can cover the whole store.
  matcher: ['/((?!_next/static|_next/image).*)']
};
