'use client';

import { Modal, Toast } from '@/components/admin/overlays';
import { Badge, Button, Checkbox, Field, Select, TextArea, TextInput } from '@/components/admin/ui';
import { CARRIERS, SHIPMENT_STATUSES, STATUS_INFO, trackingUrlFor, type ShipmentStatus } from '@/lib/tracking';
import {
  addOrderComment,
  addTrackingUpdate,
  cancelOrder,
  fulfillOrder,
  resendConfirmation,
  saveShipmentDetails,
  markOrderPaid,
  refundOrder,
  setOrderArchived,
  unfulfillOrder,
  updateOrderNote
} from '@/lib/admin/actions/orders';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ChevronDownIcon } from './icons';

type Result = { ok: true; data?: unknown } | { ok: false; error: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const run = (fn: () => Promise<Result>, success: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        const emailProblem = (res.data as { emailProblem?: string | null } | undefined)?.emailProblem;
        setToast(emailProblem ? { msg: `${success}, but the email wasn’t sent: ${emailProblem}`, error: true } : { msg: success });
        after?.();
        router.refresh();
      } else setToast({ msg: res.error, error: true });
    });
  const toastEl = <Toast message={toast?.msg ?? null} error={toast?.error} onDone={() => setToast(null)} />;
  return { pending, run, toastEl };
}

// ---------------------------------------------------------------------------
// Header actions: Refund · More actions ▾
// ---------------------------------------------------------------------------

export function OrderHeaderActions({
  orderId,
  status,
  financialStatus,
  refundable,
  currency
}: {
  orderId: string;
  status: 'open' | 'archived' | 'cancelled';
  financialStatus: string;
  refundable: number;
  currency: string;
}) {
  const { pending, run, toastEl } = useRun();
  const [menu, setMenu] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [amount, setAmount] = useState(refundable.toFixed(2));
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);
  const [refundOnCancel, setRefundOnCancel] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const canRefund = refundable > 0 && ['paid', 'partially_refunded'].includes(financialStatus);

  return (
    <>
      {canRefund && (
        <Button onClick={() => setRefundOpen(true)} disabled={pending}>
          Refund
        </Button>
      )}
      <div className="relative" ref={menuRef}>
        <Button onClick={() => setMenu((m) => !m)} disabled={pending}>
          More actions <ChevronDownIcon width={16} height={16} />
        </Button>
        {menu && (
          <div className="admin-card absolute right-0 top-10 z-20 w-52 p-1.5">
            {financialStatus === 'pending' && status !== 'cancelled' && (
              <MenuItem onClick={() => { setMenu(false); run(() => markOrderPaid(orderId), 'Order marked as paid'); }}>
                Mark as paid
              </MenuItem>
            )}
            {status === 'archived' ? (
              <MenuItem onClick={() => { setMenu(false); run(() => setOrderArchived(orderId, false), 'Order unarchived'); }}>Unarchive</MenuItem>
            ) : status === 'open' ? (
              <MenuItem onClick={() => { setMenu(false); run(() => setOrderArchived(orderId, true), 'Order archived'); }}>Archive</MenuItem>
            ) : null}
            <MenuItem onClick={() => { setMenu(false); window.print(); }}>Print order</MenuItem>
            {status !== 'cancelled' && (
              <MenuItem critical onClick={() => { setMenu(false); setCancelOpen(true); }}>
                Cancel order
              </MenuItem>
            )}
          </div>
        )}
      </div>

      <Modal
        open={refundOpen}
        title="Refund"
        onClose={() => setRefundOpen(false)}
        primaryAction={
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => run(() => refundOrder(orderId, Number(amount), reason, restock), 'Refund issued', () => setRefundOpen(false))}
          >
            Refund {currency} {Number(amount || 0).toFixed(2)}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Refund amount" helpText={`${currency} ${refundable.toFixed(2)} available for refund`}>
            <TextInput prefix="$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Reason for refund" helpText="Only you and other staff can see this reason.">
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Checkbox label="Restock items" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          <p className="text-admin-subdued">The refund goes back to the customer’s original payment method through Stripe.</p>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        title="Cancel order"
        onClose={() => setCancelOpen(false)}
        secondaryAction={<Button onClick={() => setCancelOpen(false)}>Keep order</Button>}
        primaryAction={
          <Button
            variant="critical"
            disabled={pending}
            onClick={() =>
              run(
                () => cancelOrder(orderId, { restock, refund: canRefund && refundOnCancel, reason }),
                'Order canceled',
                () => setCancelOpen(false)
              )
            }
          >
            Cancel order
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {canRefund && (
            <Checkbox
              label={`Refund ${currency} ${refundable.toFixed(2)}`}
              helpText="Refund the remaining balance through Stripe."
              checked={refundOnCancel}
              onChange={(e) => setRefundOnCancel(e.target.checked)}
            />
          )}
          <Checkbox label="Restock items" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          <Field label="Reason for cancellation">
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer changed their mind" />
          </Field>
        </div>
      </Modal>
      {toastEl}
    </>
  );
}

function MenuItem({ children, onClick, critical }: { children: React.ReactNode; onClick: () => void; critical?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-lg px-2 py-1.5 text-left hover:bg-admin-hover ${critical ? 'text-admin-critical' : ''}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Fulfillment button (in the Unfulfilled card)
// ---------------------------------------------------------------------------

export function FulfillButton({ orderId, fulfilled, disabled }: { orderId: string; fulfilled: boolean; disabled?: boolean }) {
  const { pending, run, toastEl } = useRun();
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('canada_post');
  const [url, setUrl] = useState('');
  const [notify, setNotify] = useState(true);

  if (fulfilled) {
    return (
      <>
        <Button
          size="slim"
          variant="tertiary"
          disabled={pending}
          onClick={() => window.confirm('Cancel this fulfillment?') && run(() => unfulfillOrder(orderId), 'Fulfillment canceled')}
        >
          Cancel fulfillment
        </Button>
        {toastEl}
      </>
    );
  }

  return (
    <>
      <Button variant="primary" disabled={disabled || pending} onClick={() => setOpen(true)}>
        Mark as fulfilled
      </Button>
      <Modal
        open={open}
        title="Fulfill items"
        onClose={() => setOpen(false)}
        primaryAction={
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              run(() => fulfillOrder(orderId, { tracking_number: tracking, tracking_url: url, carrier, notify }), 'Order marked as shipped', () => setOpen(false))
            }
          >
            Fulfill items
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-admin-subdued">Use this when the parcel has been handed to the carrier. The customer’s tracking page switches to “Shipped”.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Carrier">
              <Select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                {CARRIERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Tracking number">
              <TextInput value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </Field>
          </div>
          <Field label="Tracking link" helpText={url ? undefined : `Filled in automatically${tracking ? `: ${trackingUrlFor(carrier, tracking)}` : ' from the carrier and number'}.`}>
            <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Leave empty to use the carrier’s link" />
          </Field>
          <Checkbox label="Email the customer that the order has shipped" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        </div>
      </Modal>
      {toastEl}
    </>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function OrderNote({ orderId, note }: { orderId: string; note: string | null }) {
  const { pending, run, toastEl } = useRun();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? '');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">Notes</h2>
        {!editing && (
          <Button variant="plain" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <TextArea value={value} onChange={(e) => setValue(e.target.value)} rows={4} autoFocus />
          <div className="flex justify-end gap-2">
            <Button size="slim" onClick={() => { setValue(note ?? ''); setEditing(false); }}>Cancel</Button>
            <Button size="slim" variant="primary" disabled={pending} onClick={() => run(() => updateOrderNote(orderId, value), 'Note saved', () => setEditing(false))}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-admin-subdued">{note || 'No notes from customer'}</p>
      )}
      {toastEl}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline comment box
// ---------------------------------------------------------------------------

export function CommentBox({ orderId, initials }: { orderId: string; initials: string }) {
  const { pending, run, toastEl } = useRun();
  const [value, setValue] = useState('');
  return (
    <div className="admin-card flex items-start gap-3 p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#36fba1] text-[11px] font-bold text-[#0c5132]">
        {initials}
      </span>
      <div className="flex flex-1 flex-col gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Leave a comment..."
          rows={2}
          className="w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-[#8a8a8a]"
        />
        <div className="flex justify-end">
          <Button
            size="slim"
            variant={value.trim() ? 'primary' : 'secondary'}
            disabled={!value.trim() || pending}
            onClick={() => run(() => addOrderComment(orderId, value), 'Comment posted', () => setValue(''))}
          >
            Post
          </Button>
        </div>
      </div>
      {toastEl}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shipment tracking card
// ---------------------------------------------------------------------------

export type TrackingEventView = { id: string; status: ShipmentStatus; message: string | null; location: string | null; emailed_at: string | null; created_at: string };

const statusTone = (s: ShipmentStatus) =>
  s === 'delivered' ? 'success' : s === 'exception' ? 'critical' : s === 'confirmed' || s === 'processing' ? 'attention' : 'info';

export function TrackingCard({
  orderId,
  status,
  carrier: initialCarrier,
  trackingNumber,
  trackingUrl,
  estimatedDelivery,
  events,
  customerUrl,
  confirmationSentAt,
  hasEmail,
  migrationNeeded
}: {
  orderId: string;
  status: ShipmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
  events: TrackingEventView[];
  customerUrl: string | null;
  confirmationSentAt: string | null;
  hasEmail: boolean;
  migrationNeeded: boolean;
}) {
  const { pending, run, toastEl } = useRun();
  const [details, setDetails] = useState({
    carrier: initialCarrier ?? 'canada_post',
    tracking_number: trackingNumber ?? '',
    tracking_url: trackingUrl && trackingUrl !== trackingUrlFor(initialCarrier, trackingNumber) ? trackingUrl : '',
    estimated_delivery: estimatedDelivery ?? ''
  });
  const nextStatus = SHIPMENT_STATUSES[Math.min(SHIPMENT_STATUSES.indexOf(status) + 1, SHIPMENT_STATUSES.length - 2)] as ShipmentStatus;
  const [update, setUpdate] = useState({ status: nextStatus as string, location: '', message: '', notify: STATUS_INFO[nextStatus].email });
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  if (migrationNeeded) {
    return <p className="text-admin-subdued">Run <code>supabase/migrations/0004_tracking_emails_offers.sql</code> in Supabase to turn on tracking.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={statusTone(status)}>{STATUS_INFO[status].label}</Badge>
        {customerUrl && (
          <a href={customerUrl} target="_blank" rel="noreferrer" className="text-admin-link hover:underline">
            Customer’s tracking page
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Carrier">
          <Select value={details.carrier} onChange={(e) => setDetails((d) => ({ ...d, carrier: e.target.value }))}>
            {CARRIERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Tracking number">
          <TextInput value={details.tracking_number} onChange={(e) => setDetails((d) => ({ ...d, tracking_number: e.target.value }))} />
        </Field>
        <Field label="Tracking link" helpText="Leave empty to use the carrier’s page.">
          <TextInput value={details.tracking_url} placeholder={trackingUrlFor(details.carrier, details.tracking_number) ?? 'https://'} onChange={(e) => setDetails((d) => ({ ...d, tracking_url: e.target.value }))} />
        </Field>
        <Field label="Estimated delivery">
          <TextInput type="date" value={details.estimated_delivery} onChange={(e) => setDetails((d) => ({ ...d, estimated_delivery: e.target.value }))} />
        </Field>
      </div>
      <div>
        <Button disabled={pending} onClick={() => run(() => saveShipmentDetails(orderId, details), 'Tracking details saved')}>
          Save tracking details
        </Button>
      </div>

      <div className="border-t border-admin-border pt-4">
        <h3 className="mb-2 font-semibold">Post an update</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Status">
            <Select
              value={update.status}
              onChange={(e) => {
                const s = e.target.value as ShipmentStatus;
                setUpdate((u) => ({ ...u, status: s, notify: STATUS_INFO[s].email }));
              }}
            >
              {SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_INFO[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Location (optional)">
            <TextInput value={update.location} placeholder="e.g. Montreal, QC" onChange={(e) => setUpdate((u) => ({ ...u, location: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Message to the customer (optional)">
            <TextArea value={update.message} maxLength={500} rows={2} onChange={(e) => setUpdate((u) => ({ ...u, message: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            label="Email this update to the customer"
            disabled={!hasEmail}
            checked={update.notify && hasEmail}
            onChange={(e) => setUpdate((u) => ({ ...u, notify: e.target.checked }))}
          />
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => run(() => addTrackingUpdate(orderId, update), 'Update posted', () => setUpdate((u) => ({ ...u, message: '', location: '' })))}
          >
            Post update
          </Button>
        </div>
      </div>

      {events.length > 0 && (
        <ol className="flex flex-col gap-2 border-t border-admin-border pt-4">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="font-medium">{STATUS_INFO[e.status].label}</span>
                {e.location && <span className="text-admin-subdued"> · {e.location}</span>}
                {e.message && <p className="text-admin-subdued">{e.message}</p>}
              </div>
              <span className="text-right text-[12px] text-admin-subdued">
                {fmt(e.created_at)}
                {e.emailed_at && <><br />Emailed</>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-admin-border pt-4 text-admin-subdued">
        <span>{confirmationSentAt ? `Confirmation email sent ${fmt(confirmationSentAt)}` : 'No confirmation email sent yet'}</span>
        <Button size="slim" disabled={pending || !hasEmail} onClick={() => run(() => resendConfirmation(orderId), 'Confirmation email sent')}>
          {confirmationSentAt ? 'Resend confirmation' : 'Send confirmation'}
        </Button>
      </div>
      {toastEl}
    </div>
  );
}
