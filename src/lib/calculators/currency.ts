/**
 * ECargyan.com — Currency Management System
 * Separates numeric mathematical calculations from visual currency formatting.
 */

import type { CurrencyCode, CurrencyConfig } from './types.ts';

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimals: 2 },
};

export const DEFAULT_CURRENCY: CurrencyCode = 'INR';

/**
 * Format a numerical amount with the selected currency symbol and regional formatting
 */
export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY,
  options?: { compact?: boolean; hideDecimalsIfZero?: boolean }
): string {
  if (!isFinite(amount)) return `${SUPPORTED_CURRENCIES[currencyCode].symbol}0.00`;

  const config = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.INR;
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let formattedNumber: string;

  if (options?.compact && absAmount >= 10000000 && currencyCode === 'INR') {
    // Crore formatting for large INR sums
    const cr = (absAmount / 10000000).toFixed(2);
    formattedNumber = `${cr} Cr`;
  } else if (options?.compact && absAmount >= 100000 && currencyCode === 'INR') {
    // Lakh formatting for INR sums
    const lakh = (absAmount / 100000).toFixed(2);
    formattedNumber = `${lakh} Lakh`;
  } else if (options?.compact && absAmount >= 1000000) {
    // Million formatting for International
    const m = (absAmount / 1000000).toFixed(2);
    formattedNumber = `${m}M`;
  } else if (options?.compact && absAmount >= 1000) {
    const k = (absAmount / 1000).toFixed(1);
    formattedNumber = `${k}k`;
  } else {
    const minFractionDigits = options?.hideDecimalsIfZero && Number.isInteger(absAmount) ? 0 : 2;
    const maxFractionDigits = 2;

    const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
    formattedNumber = absAmount.toLocaleString(locale, {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    });
  }

  const sign = isNegative ? '-' : '';

  // Arabic Dirham postfix format
  if (currencyCode === 'AED') {
    return `${sign}${formattedNumber} ${config.symbol}`;
  }

  return `${sign}${config.symbol}${formattedNumber}`;
}
