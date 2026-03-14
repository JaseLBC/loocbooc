/**
 * Currency utilities — format cents to display strings, convert between units.
 * All monetary amounts are stored in cents (integer) to avoid floating point issues.
 */

/**
 * Convert cents integer to decimal amount.
 * e.g. 12500 → 125.00
 */
export function centsToDecimal(cents: number): number {
  return cents / 100;
}

/**
 * Convert decimal amount to cents integer.
 * e.g. 125.00 → 12500
 */
export function decimalToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Format cents as a locale currency string.
 * e.g. 12500, "AUD" → "$125.00"
 */
export function formatCents(
  cents: number,
  currency: string = "AUD",
  locale: string = "en-AU",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(centsToDecimal(cents));
}

/**
 * Calculate the deposit amount in cents given a total and deposit percentage.
 */
export function calculateDepositCents(
  totalCents: number,
  depositPercent: number,
): number {
  return Math.ceil((totalCents * depositPercent) / 100);
}

/**
 * Calculate the remaining balance in cents.
 */
export function calculateRemainingCents(
  totalCents: number,
  depositCents: number,
): number {
  return totalCents - depositCents;
}
