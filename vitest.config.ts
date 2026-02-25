import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/*/tests/**/*.test.ts', 'api/tests/**/*.test.ts'],
  },
});
