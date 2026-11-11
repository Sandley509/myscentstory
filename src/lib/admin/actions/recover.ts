'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import { recoverMissingOrders } from '@/lib/commerce/recover-orders';
import { stripeConfigured } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';

/** Checks Stripe for paid orders the site never recorded (a failed webhook). */
export async function findMissingOrders() {
  return action(async () => {
    await requireStaff();
    if (!stripeConfigured()) throw new Error('STRIPE_SECRET_KEY isn’t set on this deployment.');
    const result = await recoverMissingOrders();
    if (result.created) revalidatePath('/admin', 'layout');
    return result;
  });
}
