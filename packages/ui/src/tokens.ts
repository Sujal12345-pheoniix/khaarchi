import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FINANCIAL_THEME = {
  colors: {
    background: '#090d16',
    surface: '#111827',
    surfaceElevated: '#1f2937',
    surfaceBorder: '#374151',
    emeraldOwed: '#10b981',
    roseOwes: '#f43f5e',
    neutralSettled: '#94a3b8',
  },
  typography: {
    fontNumeric: 'tabular-nums font-mono',
  },
} as const;

export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
