import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@homeexpense/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@homeexpense/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@homeexpense/financial-core': path.resolve(__dirname, '../../packages/financial-core/src/index.ts'),
      '@homeexpense/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
      '@homeexpense/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
      '@homeexpense/config': path.resolve(__dirname, '../../packages/config/src/index.ts'),
    },
  },
});
