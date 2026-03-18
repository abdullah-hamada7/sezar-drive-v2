import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Sezar Drive',
        short_name: 'Sezar Drive',
        display: 'standalone',
        orientation: 'portrait',
        description: 'Fleet Transportation & Trip Management Platform',
        theme_color: '#111111',
        background_color: '#ffffff',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'sezar-drive-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // <== 30 days
              }
            }
          },
           {
             urlPattern: ({ url, request }) => {
              return url.pathname.startsWith('/api/') && request.method === 'GET';
             },
             // SWR: serve stale data instantly, revalidate in background
             handler: 'StaleWhileRevalidate',
             options: {
               cacheName: 'api-swr-cache',
               expiration: {
                 maxEntries: 100,
                 maxAgeSeconds: 60 * 5, // 5 minutes
               },
               cacheableResponse: {
                 statuses: [0, 200],
               },
             },
           },
           {
             urlPattern: ({ url, request }) => {
              return url.pathname.startsWith('/api/') && request.method !== 'GET';
             },
             // Safety: never cache mutations (POST/PUT/DELETE)
             handler: 'NetworkOnly',
           }
         ],
        // Safety: Unregister previous service workers
        cleanupOutdatedCaches: true,
        // Note: API is NetworkOnly (no cached API responses).
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
