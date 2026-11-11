import type { ReadonlyURLSearchParams } from 'next/navigation';

export const createUrl = (pathname: string, params: URLSearchParams | ReadonlyURLSearchParams) => {
  const paramsString = params.toString();
  return `${pathname}${paramsString.length ? `?${paramsString}` : ''}`;
};

export const ensureStartsWith = (value: string, prefix: string) =>
  value.startsWith(prefix) ? value : `${prefix}${value}`;

export function formatPrice(amount: string | number, currencyCode = 'CAD') {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol'
  }).format(Number.isFinite(value) ? value : 0);
}
