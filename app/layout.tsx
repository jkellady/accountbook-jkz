/**
 * JK Zentra Finance Cockpit — Root Layout
 *
 * The root layout wraps all pages in the application. It defines the HTML
 * document structure, loads the three Google Fonts (Inter, Fraunces,
 * JetBrains Mono), injects PWA meta tags for installability, and wraps
 * every page in the responsive AppLayout shell.
 *
 * STRUCTURE:
 *   <html>  — font CSS variables
 *   <head>  — PWA meta tags (Apple, theme-color, manifest)
 *   <body>  — bg-light, font-sans
 *     <AppLayout>  — responsive shell (sidebar/topbar/desktop + bottomnav/mobile)
 *       <PWABootstrap />  — service worker registration + offline indicator
 *       {children}        — page content
 *     </AppLayout>
 *   </body>
 * </html>
 *
 * CROSS-MODULE CONNECTIONS:
 *   - AppLayout.tsx    → conditionally shows Sidebar (desktop) / BottomNav (mobile)
 *   - AppLayout.tsx    → includes TopBar, FloatingUploadButton, MoreSheet
 *   - PWABootstrap.tsx → service worker registration + offline indicator + install prompt
 *   - globals.css      → Tailwind directives + design tokens
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/layout
 */

import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// ---------------------------------------------------------------------------
// Font configuration — loaded via next/font/google for optimal performance
// ---------------------------------------------------------------------------

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
})

// ---------------------------------------------------------------------------
// Viewport configuration (Next.js 15 — separate export from Metadata)
// ---------------------------------------------------------------------------

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#181818',
  colorScheme: 'light',
}

// ---------------------------------------------------------------------------
// Metadata — PWA + SEO + social sharing
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: {
    default: 'Zentra Finance Cockpit',
    template: '%s \u00B7 Zentra',
  },
  description:
    'Smart receipt tracking and tax management for Malaysian sole proprietors',
  applicationName: 'Zentra',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Zentra',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
    shortcut: ['/icons/icon-192.png'],
  },
  manifest: '/manifest.webmanifest',
}

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

interface RootLayoutProps {
  readonly children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
    >
      <head>
        {/* Apple PWA meta tags — not yet fully covered by Metadata API */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Zentra" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>

      <body className="font-sans bg-light text-dark antialiased touch-manipulation">
        {children}
      </body>
    </html>
  )
}
