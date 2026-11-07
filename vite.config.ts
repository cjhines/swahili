import react from '@vitejs/plugin-react';
import { type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import { decksPlugin } from './src/content/node/vite-plugin.ts';

const BUILD_SHA = process.env.GITHUB_SHA ?? 'dev';

// Stamp the commit into index.html so the deploy workflow can confirm that both
// cjhines.github.io/swahili/ and the cjhin.es/swahili/ proxy serve the new build.
const buildVersion = (): Plugin => ({
  name: 'build-version',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        name: 'swahili-version',
        content: BUILD_SHA,
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
  define: {
    __BUILD_SHA__: JSON.stringify(BUILD_SHA),
  },
  plugins: [
    react(),
    buildVersion(),
    decksPlugin(),
    VitePWA({
      // Updates never apply by themselves: the app offers them on the setup screen, so a new
      // version can never interrupt a session. Registration is done in main.tsx.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/swahili/',
        name: 'Kadi za Kiswahili',
        short_name: 'Swahili',
        description: 'Swahili flashcards with spaced repetition.',
        lang: 'en',
        // The app shares the cjhin.es origin, so the manifest and service worker are scoped to
        // /swahili/ and can never touch the rest of the site.
        start_url: '/swahili/',
        scope: '/swahili/',
        display: 'standalone',
        background_color: '#f4efe4',
        theme_color: '#0f5b4a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything, including the lazily loaded FSRS model chunk, so the app works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallbackAllowlist: [/^\/swahili\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
