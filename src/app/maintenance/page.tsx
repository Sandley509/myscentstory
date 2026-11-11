import { isMaintenanceMode } from '@/lib/maintenance';
import { SITE } from '@/lib/site';
import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Back soon',
  robots: { index: false, follow: false }
};

/** Shown to shoppers while MAINTENANCE_MODE is on (see src/lib/maintenance.ts). */
export default function MaintenancePage() {
  if (!isMaintenanceMode()) redirect('/');

  return (
    <main className="store-root flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(120%_140%_at_15%_0%,#5b0043_0%,#1a0614_60%,#000_100%)] px-6 text-center text-white">
      <Image src="/logo-white.png" alt={SITE.name} width={900} height={380} priority className="h-auto w-48" />
      <p className="eyebrow mt-12 text-accent">We’ll be right back</p>
      <h1 className="heading-caps mt-4 max-w-xl text-3xl leading-tight lg:text-5xl">Our store is getting a refresh</h1>
      <p className="mt-5 max-w-md text-sm text-neutral-300">
        We’re making a few improvements and will reopen shortly. Thank you for your patience.
      </p>
      <p className="mt-10 text-sm text-neutral-300">
        Questions about an order?{' '}
        <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-white underline">
          {SITE.supportEmail}
        </a>
      </p>
    </main>
  );
}
