import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'lib/**/*.test.ts',
      'data/**/*.test.ts',
      'components/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/utils.ts'],
    },
  },
});
