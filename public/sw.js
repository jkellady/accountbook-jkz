/**
 * JK Zentra Finance Cockpit — Service Worker
 *
 * Provides offline-capable caching for the PWA. Uses different strategies
 * based on the type of request:
 *
 * | Request Type        | Strategy             | Reason                              |
 * |---------------------|----------------------|-------------------------------------|
 * | Static assets (JS,  | Cache First          | App shell must work offline         |
 * | CSS, fonts)         | → network fallback   |                                     |
 * | API calls (Supabase)| Network First        | Data must be fresh; cache fallback  |
 * |                     | → cache fallback     | for offline resilience              |
 * | Receipt images/files| Network Only         | Private data — never cache          |
 * | Navigation routes   | Stale While Revalidate| Fast load + background refresh     |
 *
 * @version 1
 */

// =============================================================================
// Constants
// =============================================================================

/** Name of the cache store — bump version to invalidate old caches. */
const CACHE_NAME = 'zentra-v1'

/** Maximum age (in ms) for cached API responses before requiring a network refresh. */
const API_CACHE_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

// =============================================================================
// Helpers
// =============================================================================

/**
 * Logs a formatted message to the console when in debug mode.
 * @param {string} label - Log prefix (e.g. "[SW Install]").
 * @param {...unknown} args - Values to log.
 */
function swLog(label, ...args) {
  // eslint-disable-next-line no-console
  console.log(`[SW ${label}]`, ...args)
}

/**
 * Determines the request category for routing to the correct cache strategy.
 * @param {Request} request - The FetchEvent request object.
 * @returns {'static' | 'api' | 'image' | 'navigation' | 'other'} Request category.
 */
function classifyRequest(request) {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Supabase API — network first
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in')
  ) {
    return 'api'
  }

  // Receipt/file storage — never cache (private data)
  if (
    pathname.startsWith('/storage/') ||
    pathname.includes('/receipts/') ||
    pathname.includes('/vault/')
  ) {
    return 'image'
  }

  // Navigation requests (HTML pages) — stale while revalidate
  if (request.mode === 'navigate') {
    return 'navigation'
  }

  // Static assets — cache first
  if (
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.json') ||
    pathname === '/manifest.webmanifest'
  ) {
    return 'static'
  }

  // Images referenced directly — network only (could be private)
  if (
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.pdf') ||
    pathname.endsWith('.heic')
  ) {
    return 'image'
  }

  return 'other'
}

// =============================================================================
// Install — cache critical static assets
// =============================================================================

/**
 * Install event: pre-caches critical app shell assets so the app
 * works offline immediately after first visit.
 */
self.addEventListener('install', (event) => {
  swLog('Install', 'version', CACHE_NAME)

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Pre-cache critical routes and the manifest
        // Next.js handles its own chunk hashing, so we cache pages + manifest
        const criticalAssets = [
          '/',
          '/dashboard',
          '/login',
          '/manifest.webmanifest',
        ]
        return cache.addAll(criticalAssets).catch((err) => {
          // Non-blocking: some routes may not exist at build time
          swLog('Install', 'Partial cache — some routes skipped:', err.message)
        })
      })
      .then(() => {
        self.skipWaiting()
      })
  )
})

// =============================================================================
// Activate — clean up old caches
// =============================================================================

/**
 * Activate event: removes caches from previous versions and takes
 * control of all clients immediately.
 */
self.addEventListener('activate', (event) => {
  swLog('Activate', 'taking control')

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              swLog('Activate', 'deleting old cache:', name)
              return caches.delete(name)
            })
        )
      })
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return self.clients.claim()
      })
  )
})

// =============================================================================
// Fetch — route requests to appropriate cache strategy
// =============================================================================

/**
 * Fetch event: intercepts all network requests and applies the
 * appropriate caching strategy based on request classification.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const category = classifyRequest(request)

  switch (category) {
    case 'static':
      event.respondWith(cacheFirst(request))
      break

    case 'api':
      event.respondWith(networkFirst(request))
      break

    case 'image':
      // Private data — never cache receipt images or uploaded files
      event.respondWith(fetch(request))
      break

    case 'navigation':
      event.respondWith(staleWhileRevalidate(request))
      break

    case 'other':
    default:
      // For everything else, try network, fall back to cache
      event.respondWith(
        fetch(request).catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached
            // If we can't serve from cache, return a basic offline page
            if (request.mode === 'navigate') {
              return caches.match('/login')
            }
            throw new Error('Network and cache both failed for: ' + request.url)
          })
        })
      )
      break
  }
})

// =============================================================================
// Cache strategies
// =============================================================================

/**
 * Cache First strategy: serves from cache, falls back to network.
 * On a successful network fetch, updates the cache in the background.
 * Ideal for static assets (JS, CSS, fonts) that rarely change.
 *
 * @param {Request} request - The request to handle.
 * @returns {Promise<Response>} The cached or fetched response.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) {
    // Return cached immediately, then refresh in background
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone())
        }
      })
      .catch(() => {
        // Network failure is fine — we already served from cache
      })

    return cached
  }

  // Nothing in cache — must fetch
  const networkResponse = await fetch(request)
  if (networkResponse && networkResponse.ok) {
    cache.put(request, networkResponse.clone())
  }
  return networkResponse
}

/**
 * Network First strategy: tries network, falls back to cache.
 * On a successful network response, caches it for offline use.
 * Ideal for API calls where fresh data is preferred but offline
 * resilience is required.
 *
 * @param {Request} request - The request to handle.
 * @returns {Promise<Response>} The network or cached response.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)

  try {
    const networkResponse = await fetch(request)

    if (networkResponse && networkResponse.ok) {
      // Clone and cache for offline use
      const responseClone = networkResponse.clone()
      const cachedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: {
          ...Object.fromEntries(responseClone.headers.entries()),
          'x-sw-cached-at': Date.now().toString(),
        },
      })
      cache.put(request, cachedResponse)
    }

    return networkResponse
  } catch (networkError) {
    // Network failed — try cache
    const cached = await cache.match(request)

    if (cached) {
      // Check cache age
      const cachedAt = cached.headers.get('x-sw-cached-at')
      const age = cachedAt ? Date.now() - parseInt(cachedAt, 10) : Infinity

      if (age < API_CACHE_MAX_AGE_MS) {
        swLog('NetworkFirst', 'Serving stale cache (age:', Math.round(age / 1000), 's)')
        return cached
      }
    }

    // No usable cache — propagate the error
    throw networkError
  }
}

/**
 * Stale While Revalidate strategy: serves from cache immediately for
 * speed, then refreshes from network in the background.
 * Ideal for navigation routes (HTML pages) where fast loads matter.
 *
 * @param {Request} request - The request to handle.
 * @returns {Promise<Response>} The cached (or fresh) response.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  // Always try network in the background
  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    })
    .catch(() => {
      // Network failed — we still have cache
    })

  if (cached) {
    // Return cached version immediately; network updates in background
    // Also trigger a background revalidation event for UI notifications
    networkPromise.then(() => {
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATE_AVAILABLE',
          })
        })
      })
    })
    return cached
  }

  // No cache — must wait for network
  return networkPromise
}

// =============================================================================
// Message handling — communication with the app
// =============================================================================

/**
 * Listen for messages from the client (e.g. "skipWaiting" command).
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
