export const APP_CONFIG = {
  name: 'HomeExpense',
  version: '1.0.0',
  apiPrefix: '/api/v1',
  defaultCurrency: 'INR',
  supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP'] as const,
  tokenExpiry: '7d',
  maxUploadSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ] as const,
};

export * from '@homeexpense/validation';
