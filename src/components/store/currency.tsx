'use client';

import { convert, currencyForCountry, currencyLabel, formatMoney, isCrawler, POPULAR_CURRENCIES, type Rates } from '@/lib/currency';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const CHOICE_KEY = 'mss-currency';
const GEO_KEY = 'mss-geo';

type CurrencyContextValue = {
  /** Store currency: what checkout charges. */
  base: string;
  /** Currency prices are displayed in. */
  currency: string;
  rates: Rates | null;
  detectedCountry: string | null;
  setCurrency: (code: string) => void;
  /** Currencies the picker offers (only those we have a rate for). */
  options: string[];
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
};

/**
 * Picks the display currency: the visitor's own choice, else the currency of
 * the country they browse from, else the store currency. Pages are rendered
 * in the store currency first, so search engines and the product feed always
 * agree, and switch after the page loads.
 */
export function CurrencyProvider({ base, children }: { base: string; children: ReactNode }) {
  const [currency, setCurrencyState] = useState(base);
  const [rates, setRates] = useState<Rates | null>(null);
  const [detectedCountry, setDetected] = useState<string | null>(null);

  useEffect(() => {
    if (isCrawler(navigator.userAgent)) return;
    let cancelled = false;

    (async () => {
      const ratesPromise = fetch('/api/rates')
        .then((r) => (r.ok ? (r.json() as Promise<Rates>) : null))
        .catch(() => null);

      let country: string | null = null;
      const cached = read(GEO_KEY);
      if (cached && /^[A-Z]{2}$|^-$/.test(cached)) {
        country = cached === '-' ? null : cached;
      } else {
        const geo = await fetch('/api/geo', { cache: 'no-store' })
          .then((r) => (r.ok ? (r.json() as Promise<{ country: string | null }>) : null))
          .catch(() => null);
        country = geo?.country ?? null;
        write(GEO_KEY, country ?? '-');
      }

      const r = await ratesPromise;
      if (cancelled) return;
      setDetected(country);
      if (r && r.base === base) setRates(r);

      const wanted = read(CHOICE_KEY) || currencyForCountry(country) || base;
      if (wanted === base || (r && r.base === base && r.rates[wanted])) setCurrencyState(wanted);
    })();

    return () => {
      cancelled = true;
    };
  }, [base]);

  const options = useMemo(() => {
    const detected = currencyForCountry(detectedCountry);
    const list = [base, ...(detected ? [detected] : []), ...POPULAR_CURRENCIES];
    return [...new Set(list)].filter((c) => c === base || rates?.rates[c]);
  }, [base, detectedCountry, rates]);

  const value: CurrencyContextValue = {
    base,
    currency,
    rates,
    detectedCountry,
    options,
    setCurrency: (code) => {
      if (code !== base && !rates?.rates[code]) return;
      write(CHOICE_KEY, code);
      setCurrencyState(code);
    }
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used inside <CurrencyProvider>');
  return ctx;
}

/** True while prices are shown in a currency other than the one checkout charges. */
export function useIsConverted() {
  const { currency, base } = useCurrency();
  return currency !== base;
}

/**
 * A price in the visitor's currency. The store-currency price stays in the
 * markup (and in a tooltip), so nothing is hidden from crawlers or screen readers.
 */
export function Money({ amount, currencyCode, className }: { amount: string | number; currencyCode: string; className?: string }) {
  const { currency, rates, base } = useCurrency();
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const original = formatMoney(Number.isFinite(value) ? value : 0, currencyCode);
  if (currency === currencyCode || currencyCode !== base) return <span className={className}>{original}</span>;
  const converted = convert(value, currency, rates);
  if (converted === null) return <span className={className}>{original}</span>;
  return (
    <span className={className} title={`${original} (charged at checkout)`}>
      {formatMoney(converted, currency, { approximate: true })}
    </span>
  );
}

export function CurrencySelect({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { currency, setCurrency, options } = useCurrency();
  if (options.length < 2) return null;
  return (
    <label className={`flex items-center gap-1.5 ${className}`}>
      <span className="sr-only">Currency</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="h-8 cursor-pointer border border-line bg-page px-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] outline-none hover:border-fg"
      >
        {options.map((c) => (
          <option key={c} value={c}>
            {compact ? c : currencyLabel(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Small notice shown wherever money is about to change hands. */
export function ChargeNotice({ amount, className = '' }: { amount?: string | number; className?: string }) {
  const { currency, base } = useCurrency();
  if (currency === base) return null;
  return (
    <p className={`text-[11px] leading-snug text-muted ${className}`}>
      Prices in {currency} are estimates based on current exchange rates.{' '}
      {amount !== undefined ? (
        <>
          You’ll be charged <strong className="font-semibold text-fg">{formatMoney(Number(amount), base)}</strong> at checkout.
        </>
      ) : (
        <>Checkout charges {base}.</>
      )}{' '}
      <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="underline">
        Rates by ExchangeRate-API
      </a>
    </p>
  );
}
