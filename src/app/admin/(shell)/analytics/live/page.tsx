import { LiveViewPanel } from '@/components/admin/analytics-client';
import { Page } from '@/components/admin/ui';
import { requireStaffPage } from '@/lib/admin/auth';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Live view' };

export default async function LiveViewPage() {
  await requireStaffPage();
  return (
    <Page title="Live view" backHref="/admin/analytics">
      <LiveViewPanel />
    </Page>
  );
}
