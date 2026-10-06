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
    },
  },
});
