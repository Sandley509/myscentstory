import 'server-only';

/**
 * Transactional email through Resend (resend.com: free up to 3,000 emails a month).
 *
 * Needs RESEND_API_KEY and EMAIL_FROM (an address on a domain you verified in
 * Resend, e.g. "MyScentStory <orders@myscentstory.net>"). Without them emails
 * are skipped and logged, so checkout keeps working while you set it up.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(msg: EmailMessage): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!emailConfigured()) {
    console.warn(`[email] RESEND_API_KEY / EMAIL_FROM not set; skipped “${msg.subject}” to ${msg.to}`);
    return { ok: false, error: 'Email isn’t set up yet (RESEND_API_KEY and EMAIL_FROM).' };
  }
  try {
    const res = await fetch(`${process.env.RESEND_API_URL || 'https://api.resend.com'}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {})
      })
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !data.id) return { ok: false, error: data.message || `Email provider returned ${res.status}` };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Email could not be sent.' };
  }
}
