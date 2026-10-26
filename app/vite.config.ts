import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE lets GitHub Pages serve the app from /<repo-name>/
export default defineConfig({
  base: process.env.BASE ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Sharp Deals',
        short_name: 'Sharp Deals',
        description: 'Every special from Checkers, Pick n Pay, Woolworths, Spar, Clicks and Dis-Chem in one place.',
        theme_color: '#ff5a36',
        background_color: '#f6f7fb',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            // Deal data changes often: show the cached copy instantly, refresh in the background.
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'deal-data' },
          },
        ],
      },
    }),
  ],
  server: { host: true },
})
