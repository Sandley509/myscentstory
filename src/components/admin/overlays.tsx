'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './icons';
import { Button } from './ui';

/** Portals to <body> so `position: fixed` is always relative to the viewport. */
function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

/**
 * Contextual save bar — replaces the top bar while a form has unsaved changes,
 * like the Shopify admin.
 */
export function SaveBar({
  visible,
  saving,
  message = 'Unsaved changes',
  onSave,
  onDiscard,
  saveLabel = 'Save'
}: {
  visible: boolean;
  saving?: boolean;
  message?: string;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
}) {
  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!visible) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [visible]);

  if (!visible) return null;
  return (
    <Portal>
      <div className="admin-root fixed inset-x-0 top-0 z-[60] !min-h-0 bg-transparent">
        <div className="flex h-14 items-center justify-between gap-3 bg-admin-top px-4 text-white">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-[#ffb800]" />
            {message}
          </div>
          <div className="flex gap-2">
            {onDiscard && (
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving}
                className="h-8 rounded-lg bg-[#3a3a3a] px-3 text-[13px] font-semibold hover:bg-[#474747] disabled:opacity-50"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="h-8 rounded-lg bg-white px-3 text-[13px] font-semibold text-[#303030] hover:bg-[#f1f1f1] disabled:opacity-60"
            >
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  primaryAction,
  secondaryAction,
  width = 620
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <Portal>
      <div className="admin-root fixed inset-0 z-[70] flex items-end justify-center !bg-black/50 sm:items-center sm:p-4">
        <button className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl"
          style={{ maxWidth: width }}
        >
          <div className="flex items-center justify-between border-b border-admin-border bg-[#f3f3f3] px-4 py-3">
            <h2 className="text-[14px] font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-admin-subdued hover:bg-black/5" aria-label="Close">
              <XIcon width={18} height={18} />
            </button>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
          {(primaryAction || secondaryAction) && (
            <div className="flex justify-end gap-2 border-t border-admin-border px-4 py-3">
              {secondaryAction ?? <Button onClick={onClose}>Cancel</Button>}
              {primaryAction}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

/** Transient confirmation, bottom-centre, like Shopify's toast. */
export function Toast({ message, onDone, error }: { message: string | null; onDone: () => void; error?: boolean }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => done.current(), 3000);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
        <div
          className={`pointer-events-auto rounded-xl px-4 py-2.5 text-[13px] font-medium text-white shadow-lg ${error ? 'bg-[#c70a24]' : 'bg-[#1a1a1a]'}`}
          role="status"
        >
          {message}
        </div>
      </div>
    </Portal>
  );
}
