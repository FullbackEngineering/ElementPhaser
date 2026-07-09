import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' → itch.io / Poki / statik hosting altında da çalışsın (göreli yollar).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  // jsdom: EventBus (Phaser EventEmitter) ve SaveManager (localStorage) node'da koşsun.
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Element Grinder',
        short_name: 'ElementGrinder',
        description: 'Düşen elementleri doğru öğütücüye denk getir!',
        theme_color: '#0f1226',
        background_color: '#0f1226',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] }
    })
  ]
});
