import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@homeexpense/types': path.resolve(__dirname, '../types/src/index.ts'),
      '@homeexpense/financial-core': path.resolve(__dirname, '../financial-core/src/index.ts'),
      '@homeexpense/validation': path.resolve(__dirname, '../validation/src/index.ts'),
    },
  },
});
