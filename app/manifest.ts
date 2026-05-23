/**
 * JK Zentra Finance Cockpit — Web App Manifest
 *
 * Next.js 15 manifest.ts file that generates a dynamic manifest.webmanifest.
 * Defines the PWA's identity, theming, icons, and launch behaviour for
 * installable web app experience on mobile and desktop.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
 */

import { MetadataRoute } from 'next'

/**
 * Generates the Web App Manifest for the JK Zentra Finance Cockpit.
 *
 * The manifest controls how the app appears when installed to the home screen
 * on mobile (iOS/Android) and desktop. All values are hardcoded to match the
 * Zentra design system.
 *
 * @returns A MetadataRoute.Manifest object consumed by Next.js.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JK Zentra Finance Cockpit',
    short_name: 'Zentra',
    description:
      'Smart receipt tracking and tax management for Malaysian sole proprietors',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FAFAF7',
    theme_color: '#181818',
    orientation: 'portrait',
    scope: '/',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
