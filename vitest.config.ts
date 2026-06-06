import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for the funds-critical pure logic (derivation, addresses, key
// import, signing, vault migration). Node environment — no DOM needed; chrome.*
// is stubbed per-test where required.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
