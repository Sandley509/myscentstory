'use client';

import { isCrawler } from '@/lib/currency';
import { randomId as uuid } from '@/lib/uuid';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const VISITOR_KEY = 'mss-vid';
const SESSION_KEY = 'mss-sid';
const SESSION_IDLE_MS = 30 * 60 * 1000;
const PING_MS = 30 * 1000;
/** A visitor number is replaced after 13 months, like the stats it belongs to. */
const VISITOR_MAX_AGE_MS = 395 * 24 * 60 * 60 * 1000;


function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null; // Unreadable value: start over rather than fail on every page.
  }
}

function ids(): { vid: string; sid: string; fresh: boolean } {
  let vid = '';
  let sid = '';
  let fresh = false;
  try {
    const v = readJson<{ id: string; at: number }>(VISITOR_KEY);
    if (v?.id && Date.now() - v.at < VISITOR_MAX_AGE_MS) vid = v.id;
    else localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: (vid = uuid()), at: Date.now() }));
    const saved = readJson<{ id: string; at: number }>(SESSION_KEY);
    if (saved && Date.now() - saved.at < SESSION_IDLE_MS) sid = saved.id;
    else {
      sid = uuid();
      fresh = true;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: sid, at: Date.now() }));
  } catch {
    // Storage blocked: count this page load on its own.
    vid ||= uuid();
    sid ||= uuid();
    fresh = true;
  }
  return { vid, sid, fresh };
}

function send(data: Record<string, unknown>) {
  const body = JSON.stringify(data);
  try {
    if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    // Fall back to fetch.
  }
  void fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(
    () => undefined
  );
}

/** Counts page views for /admin → Analytics and keeps the live view up to date. */
export function VisitTracker() {
  // A new page = a new path; changing sort or filters on the same page is not a new view.
  const pathname = usePathname();
  const firstView = useRef(true);

  useEffect(() => {
    if (isCrawler(navigator.userAgent) || navigator.webdriver) return;
    const { vid, sid, fresh } = ids();
    // The referring site only matters for the first page of a visit.
    const ref = firstView.current && fresh ? document.referrer : '';
    firstView.current = false;
    send({ type: 'view', vid, sid, path: window.location.pathname + window.location.search, ref });
  }, [pathname]);

  useEffect(() => {
    if (isCrawler(navigator.userAgent) || navigator.webdriver) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const { vid, sid } = ids();
      send({ type: 'ping', vid, sid, path: window.location.pathname + window.location.search });
    }, PING_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
