import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Equilibrium Household Design Tokens
 * Sourced directly from design/DESIGN.md
 */
export const EQUILIBRIUM_THEME = {
  name: 'Equilibrium Household',
  colors: {
    // Canvas & Structural Surfaces
    surface: '#f6f9ff',
    surfaceDim: '#cfdbe8',
    surfaceBright: '#f6f9ff',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#ebf5ff',
    surfaceContainer: '#e3effc',
    surfaceContainerHigh: '#ddeaf7',
    surfaceContainerHighest: '#d8e4f1',

    // Ink & Content
    onSurface: '#111d26',
    onSurfaceVariant: '#44474a',
    inverseSurface: '#26323b',
    inverseOnSurface: '#e6f2ff',

    // Hairlines & Strokes
    outline: '#75777a',
    outlineVariant: '#c5c7ca',
    surfaceTint: '#5b5f62',

    // Primary Brand (Mineral Basalt / Deep Black)
    primary: '#000000',
    onPrimary: '#ffffff',
    primaryContainer: '#181c1f',
    onPrimaryContainer: '#818488',

    // Secondary (Deep Evergreen Credit & Equilibrium)
    secondary: '#116c47',
    onSecondary: '#ffffff',
    secondaryContainer: '#9ef1c2',
    onSecondaryContainer: '#18704b',

    // Semantic Debit / Error / Terracotta
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',
  },
  typography: {
    fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontNumeric: 'tabular-nums font-mono',
  },
  elevation: {
    level0: 'none',
    level1: '0 1px 3px 0 rgba(18, 22, 25, 0.03), 0 1px 2px -1px rgba(18, 22, 25, 0.02)',
    level2: '0 4px 12px -2px rgba(18, 22, 25, 0.06), 0 2px 6px -1px rgba(18, 22, 25, 0.03)',
    level3: '0 20px 25px -5px rgba(18, 22, 25, 0.08), 0 8px 10px -6px rgba(18, 22, 25, 0.04)',
  },
} as const;

export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
