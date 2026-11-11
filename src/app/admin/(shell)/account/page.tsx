import { requireStaffPage } from '@/lib/admin/auth';
import type { Metadata } from 'next';
import { AccountForm } from './account-form';

export const metadata: Metadata = { title: 'Your account' };

export default async function AccountPage() {
  const { staff } = await requireStaffPage();
  return <AccountForm email={staff.email} name={staff.name ?? ''} />;
}
