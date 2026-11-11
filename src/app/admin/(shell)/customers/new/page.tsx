import { CustomerForm } from '@/components/admin/customer-form';
import { requireStaffPage } from '@/lib/admin/auth';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New customer' };

export default async function NewCustomerPage() {
  await requireStaffPage();
  return (
    <CustomerForm
      title="New customer"
      initial={{ email: '', first_name: '', last_name: '', phone: '', accepts_marketing: false, note: '', tags: [] }}
    />
  );
}
