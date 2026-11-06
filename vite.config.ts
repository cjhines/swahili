import react from '@vitejs/plugin-react';
import { type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Stamp the commit into index.html so the deploy workflow can confirm that both
// cjhines.github.io/swahili/ and the cjhin.es/swahili/ proxy serve the new build.
const buildVersion = (): Plugin => ({
  name: 'build-version',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        name: 'swahili-version',
        content: process.env.GITHUB_SHA ?? 'dev',
      },
      injectTo: 'head',
    },
  ],
});

export default defineConfig({
  // The app is served from a path, never a domain root: cjhin.es/swahili/ (proxied by nginx)
  // and cjhines.github.io/swahili/ (GitHub Pages project site). Every asset URL must sit
  // under this prefix. The Playwright smoke test fails if one doesn't.
  base: '/swahili/',
  plugins: [react(), buildVersion()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
