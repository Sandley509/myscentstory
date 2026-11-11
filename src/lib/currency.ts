/**
 * Display currencies.
 *
 * The store sells in one currency (/admin → Settings, CAD by default). Visitors
 * can see approximate prices in their own currency, picked from the country
 * their connection comes from. Checkout still charges the store currency.
 */

/** ISO 3166 country → ISO 4217 currency. Countries not listed fall back to the store currency. */
const BY_COUNTRY: Record<string, string> = {
  // North America & Caribbean
  CA: 'CAD', US: 'USD', MX: 'MXN', HT: 'HTG', DO: 'DOP', JM: 'JMD', TT: 'TTD', BS: 'BSD', BB: 'BBD', BZ: 'BZD',
  CR: 'CRC', GT: 'GTQ', HN: 'HNL', NI: 'NIO', PA: 'USD', SV: 'USD', PR: 'USD', CU: 'CUP', AW: 'AWG', KY: 'KYD',
  AG: 'XCD', DM: 'XCD', GD: 'XCD', KN: 'XCD', LC: 'XCD', VC: 'XCD', AI: 'XCD', MS: 'XCD', BM: 'BMD',
  GP: 'EUR', MQ: 'EUR', GF: 'EUR', BL: 'EUR', MF: 'EUR', CW: 'ANG', SX: 'ANG', TC: 'USD', VG: 'USD', VI: 'USD',
  // South America
  BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', UY: 'UYU', PY: 'PYG', BO: 'BOB', EC: 'USD', VE: 'VES',
  GY: 'GYD', SR: 'SRD',
  // Euro area
  AT: 'EUR', BE: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR', FR: 'EUR', DE: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR',
  LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR', SI: 'EUR', ES: 'EUR', HR: 'EUR',
  MC: 'EUR', SM: 'EUR', VA: 'EUR', AD: 'EUR', ME: 'EUR', XK: 'EUR', RE: 'EUR', YT: 'EUR', PM: 'EUR',
  // Rest of Europe
  GB: 'GBP', CH: 'CHF', LI: 'CHF', NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK', HU: 'HUF',
  RO: 'RON', BG: 'BGN', RS: 'RSD', BA: 'BAM', MK: 'MKD', AL: 'ALL', MD: 'MDL', UA: 'UAH', GE: 'GEL', AM: 'AMD',
  AZ: 'AZN', TR: 'TRY', RU: 'RUB', BY: 'BYN', GI: 'GIP', JE: 'GBP', GG: 'GBP', IM: 'GBP', FO: 'DKK', GL: 'DKK',
  // Middle East
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', IL: 'ILS', JO: 'JOD', LB: 'LBP', EG: 'EGP',
  IQ: 'IQD', IR: 'IRR', YE: 'YER', PS: 'ILS',
  // Africa
  NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR', MA: 'MAD', DZ: 'DZD', TN: 'TND', ET: 'ETB', TZ: 'TZS', UG: 'UGX',
  RW: 'RWF', CD: 'CDF', AO: 'AOA', MZ: 'MZN', ZM: 'ZMW', ZW: 'USD', BW: 'BWP', NA: 'NAD', MU: 'MUR', MG: 'MGA',
  SN: 'XOF', CI: 'XOF', BJ: 'XOF', BF: 'XOF', ML: 'XOF', NE: 'XOF', TG: 'XOF', GW: 'XOF',
  CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
  SD: 'SDG', LY: 'LYD', MW: 'MWK', SL: 'SLE', LR: 'LRD', GM: 'GMD', GN: 'GNF', CV: 'CVE', SC: 'SCR', SO: 'SOS',
  BI: 'BIF', DJ: 'DJF', ER: 'ERN', LS: 'LSL', SZ: 'SZL', ST: 'STN', KM: 'KMF', MR: 'MRU', SS: 'SSP',
  // Asia & Pacific
  CN: 'CNY', HK: 'HKD', MO: 'MOP', TW: 'TWD', JP: 'JPY', KR: 'KRW', IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR',
  NP: 'NPR', SG: 'SGD', MY: 'MYR', TH: 'THB', VN: 'VND', ID: 'IDR', PH: 'PHP', KH: 'KHR', LA: 'LAK', MM: 'MMK',
  MN: 'MNT', KZ: 'KZT', UZ: 'UZS', KG: 'KGS', TJ: 'TJS', TM: 'TMT', AF: 'AFN', MV: 'MVR', BT: 'BTN', BN: 'BND',
  AU: 'AUD', NZ: 'NZD', FJ: 'FJD', PG: 'PGK', NC: 'XPF', PF: 'XPF', WS: 'WST', TO: 'TOP', VU: 'VUV', SB: 'SBD'
};

/** Currencies offered in the picker (any detected currency is added to these). */
export const POPULAR_CURRENCIES = [
  'CAD', 'USD', 'EUR', 'GBP', 'AUD', 'CHF', 'MXN', 'BRL', 'HTG', 'DOP', 'JMD', 'XOF', 'XAF', 'NGN', 'GHS',
  'MAD', 'ZAR', 'AED', 'SAR', 'INR', 'JPY', 'CNY', 'HKD', 'SGD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY'
];

export const currencyForCountry = (country: string | null | undefined): string | null =>
  (country && BY_COUNTRY[country.toUpperCase()]) || null;

export type Rates = { base: string; rates: Record<string, number>; updated: string | null };

/** Converts an amount from the store currency; null when no rate is known. */
export function convert(amount: number, to: string, rates: Rates | null): number | null {
  if (!rates || to === rates.base) return amount;
  const r = rates.rates[to];
  return r && Number.isFinite(r) ? amount * r : null;
}

/**
 * Formats a price. Converted amounts are rounded to whole units when they are
 * large (¥1,834 rather than ¥1,834.27) to look like real prices, not maths.
 */
export function formatMoney(amount: number, currency: string, opts: { approximate?: boolean } = {}): string {
  let digits: number | undefined;
  try {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
  const whole = opts.approximate && (digits === 0 || amount >= 1000);
  const value = whole ? Math.round(amount) : amount;
  const fmt = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    // "CA$", "US$", "€": unambiguous for a store that sells worldwide.
    currencyDisplay: 'symbol',
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: whole ? 0 : digits
  });
  return fmt.format(value);
}

export function currencyLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code);
    return name ? `${code} · ${name}` : code;
  } catch {
    return code;
  }
}

/** Crawlers keep the store currency, so what they read matches the product feed. */
export const isCrawler = (userAgent: string) =>
  /bot|crawl|spider|slurp|googlebot|adsbot|mediapartners|google-inspectiontool|storebot|facebookexternalhit|meta-externalagent|bingpreview|lighthouse/i.test(
    userAgent
  );
