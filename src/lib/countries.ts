/**
 * Where the store ships.
 *
 * /admin → Settings stores either a list of country codes or ['WORLD'] for
 * worldwide shipping. These helpers turn that into what Stripe Checkout,
 * the product feed and the structured data each need.
 */
import type { StoreSettingsRow } from './commerce/db';
import { SITE } from './site';

export const WORLDWIDE = 'WORLD';

/** Every country Stripe Checkout can collect a shipping address for. */
export const STRIPE_SHIPPING_COUNTRIES = [
  'AC', 'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB',
  'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY',
  'BZ', 'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CV', 'CW', 'CY', 'CZ', 'DE',
  'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FO', 'FR', 'GA',
  'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT',
  'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MK', 'ML', 'MM', 'MN', 'MO', 'MQ', 'MR', 'MS', 'MT',
  'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU',
  'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST',
  'SV', 'SX', 'SZ', 'TA', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV',
  'TW', 'TZ', 'UA', 'UG', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VN', 'VU', 'WF', 'WS', 'XK', 'YE', 'YT',
  'ZA', 'ZM', 'ZW'
] as const;

export const shipsWorldwide = (settings: Pick<StoreSettingsRow, 'allowed_countries'>) =>
  (settings.allowed_countries ?? []).includes(WORLDWIDE);

/** Countries offered in Stripe Checkout's address form. */
export function checkoutCountries(settings: Pick<StoreSettingsRow, 'allowed_countries'>): string[] {
  if (shipsWorldwide(settings)) return [...STRIPE_SHIPPING_COUNTRIES];
  const list = (settings.allowed_countries ?? []).filter((c) => /^[A-Z]{2}$/.test(c));
  return list.length ? list : ['CA', 'US'];
}

/**
 * Countries listed in the Google/Meta feed and structured data. Worldwide
 * shipping is summarised as your main markets (SITE.shipping.feedCountries):
 * listing 200+ countries on every product would bloat the feed.
 */
export function listedShippingCountries(settings: Pick<StoreSettingsRow, 'allowed_countries'>): string[] {
  return shipsWorldwide(settings) ? [...SITE.shipping.feedCountries] : checkoutCountries(settings);
}

export function countryName(code: string, locale = 'en'): string {
  if (code === WORLDWIDE) return 'Worldwide';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
