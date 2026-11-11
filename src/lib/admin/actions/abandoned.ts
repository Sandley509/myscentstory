'use server';

import { loadAbandonedCart } from '@/lib/admin/abandoned';
import { action, requireStaff } from '@/lib/admin/auth';
import { getStoreSettings } from '@/lib/commerce';
import { cartRecoveryLink } from '@/lib/commerce/order-link';
import { sendEmail } from '@/lib/email';
import { cartReminderEmail } from '@/lib/email-templates';
import { SITE } from '@/lib/site';
import { revalidatePath } from 'next/cache';

/** Emails the shopper a reminder with a link that restores their cart. */
export async function sendCartReminder(cartId: string) {
  return action(async () => {
    const { supabase } = await requireStaff();
    const cart = await loadAbandonedCart(supabase, cartId);
    if (!cart) throw new Error('This cart was bought or no longer exists.');
    if (!cart.email) throw new Error('This cart has no email address.');

    const settings = await getStoreSettings();
    const supportEmail = settings.contact_email || SITE.supportEmail;
    const { subject, html, text } = cartReminderEmail(
      {
        storeName: settings.store_name || SITE.name,
        supportEmail,
        footerNote: `You’re receiving this because you started an order with us. Don’t want reminders? Reply “unsubscribe” or write to ${supportEmail}.`
      },
      {
        items: cart.items,
        currency: settings.currency,
        recoverUrl: cartRecoveryLink(cart.id),
        discountCode: cart.discountCode,
        freeShippingOver: Number(settings.free_shipping_threshold) || 0
      }
    );
    const res = await sendEmail({ to: cart.email, subject, html, text, replyTo: supportEmail });
    if (!res.ok) throw new Error(res.error);

    const { error } = await supabase.from('carts').update({ recovery_email_sent_at: new Date().toISOString() }).eq('id', cart.id);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/orders/abandoned');
    return { sentTo: cart.email };
  });
}
