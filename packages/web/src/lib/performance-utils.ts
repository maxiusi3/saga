/**
 * Performance Optimization Utilities for Saga UI
 * Provides tools for monitoring and optimizing performance
 */

// Image Optimization
export const imageUtils = {
  // Lazy loading configuration
  lazyLoadConfig: {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
  },

  // Responsive image sizes for different breakpoints
  responsiveSizes: {
    avatar: '(max-width: 640px) 32px, (max-width: 768px) 40px, 48px',
    thumbnail: '(max-width: 640px) 64px, (max-width: 768px) 80px, 96px',
    story: '(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw',
    hero: '100vw',
  },

  // WebP support detection
  supportsWebP: (): Promise<boolean> => {
    return new Promise((resolve) => {
      const webP = new Image()
      webP.onload = webP.onerror = () => {
        resolve(webP.height === 2)
      }
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
    })
  },

  // Generate optimized image URL
  getOptimizedImageUrl: (
    originalUrl: string,
    width: number,
    height?: number,
    format?: 'webp' | 'jpeg' | 'png'
  ): string => {
    // This would typically integrate with an image optimization service
    // For now, return the original URL with query parameters
    const params = new URLSearchParams()
    params.set('w', width.toString())
    if (height) params.set('h', height.toString())
    if (format) params.set('f', format)
    
    return `${originalUrl}?${params.toString()}`
  },
}

// Code Splitting and Lazy Loading
export const codeSpittingUtils = {
  // Dynamic import wrapper with error handling
  dynamicImport: async <T>(importFn: () => Promise<T>): Promise<T | null> => {
    try {
      return await importFn()
    } catch (error) {
      console.error('Dynamic import failed:', error)
      return null
    }
  },

  // Preload critical components
  preloadComponent: (importFn: () => Promise<any>) => {
    // Preload on idle or after a delay
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => importFn())
    } else {
      setTimeout(() => importFn(), 100)
    }
  },

  // Route-based code splitting patterns
  routeComponents: {
    dashboard: () => import('@/components/dashboard/welcome-header'),
    stories: () => import('@/components/stories/story-list-page'),
    recording: () => import('@/components/recording/recording-interface'),
    settings: () => import('@/components/settings/settings-page'),
    purchase: () => import('@/components/purchase/hero-section'),
  },
}

// Performance Monitoring
export const performanceUtils = {
  // Core Web Vitals measurement
  measureCoreWebVitals: () => {
    // Largest Contentful Paint (LCP)
    const measureLCP = () => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          resolve(lastEntry.startTime)
        }).observe({ entryTypes: ['largest-contentful-paint'] })
      })
    }

    // First Input Delay (FID)
    const measureFID = () => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            resolve(entry.processingStart - entry.startTime)
          })
        }).observe({ entryTypes: ['first-input'] })
      })
    }

    // Cumulative Layout Shift (CLS)
    const measureCLS = () => {
      return new Promise<number>((resolve) => {
        let clsValue = 0
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          })
          resolve(clsValue)
        }).observe({ entryTypes: ['layout-shift'] })
      })
    }

    return {
      lcp: measureLCP(),
      fid: measureFID(),
      cls: measureCLS(),
    }
  },

  // Performance budget monitoring
  checkPerformanceBudget: () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    const metrics = {
      // Time to First Byte
      ttfb: navigation.responseStart - navigation.requestStart,
      // DOM Content Loaded
      dcl: navigation.domContentLoadedEventEnd - navigation.navigationStart,
      // Load Complete
      load: navigation.loadEventEnd - navigation.navigationStart,
      // First Paint
      fp: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
      // First Contentful Paint
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
    }

    // Performance budgets (in milliseconds)
    const budgets = {
      ttfb: 200,
      dcl: 1500,
      load: 3000,
      fp: 1000,
      fcp: 1500,
    }

    const violations = Object.entries(metrics)
      .filter(([key, value]) => value > budgets[key as keyof typeof budgets])
      .map(([key, value]) => ({
        metric: key,
        actual: value,
        budget: budgets[key as keyof typeof budgets],
        violation: value - budgets[key as keyof typeof budgets],
      }))

    return { metrics, budgets, violations }
  },

  // Memory usage monitoring
  monitorMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      }
    }
    return null
  },
}

// Bundle Analysis
export const bundleUtils = {
  // Analyze bundle size impact
  analyzeBundleSize: () => {
    const scripts = Array.from(document.querySelectorAll('script[src]'))
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    
    const resources = [...scripts, ...styles].map((element) => {
      const src = element.getAttribute('src') || element.getAttribute('href')
      return {
        url: src,
        type: element.tagName.toLowerCase(),
        size: 0, // Would need to fetch to get actual size
      }
    })

    return resources
  },

  // Critical resource identification
  identifyCriticalResources: () => {
    const criticalResources = performance.getEntriesByType('resource')
      .filter((resource: any) => {
        // Identify critical resources based on timing
        return resource.startTime < 1000 && resource.duration > 100
      })
      .map((resource: any) => ({
        name: resource.name,
        type: resource.initiatorType,
        startTime: resource.startTime,
        duration: resource.duration,
        size: resource.transferSize,
      }))

    return criticalResources
  },
}

// Caching Strategies
export const cachingUtils = {
  // Service Worker registration
  registerServiceWorker: async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registered:', registration)
        return registration
      } catch (error) {
        console.error('Service Worker registration failed:', error)
        return null
      }
    }
    return null
  },

  // Cache API utilities
  cacheResource: async (cacheName: string, url: string) => {
    if ('caches' in window) {
      const cache = await caches.open(cacheName)
      await cache.add(url)
    }
  },

  getCachedResource: async (cacheName: string, url: string) => {
    if ('caches' in window) {
      const cache = await caches.open(cacheName)
      return await cache.match(url)
    }
    return null
  },

  // Browser storage utilities
  localStorage: {
    set: (key: string, value: any) => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch (error) {
        console.warn('localStorage.setItem failed:', error)
      }
    },
    get: (key: string) => {
      try {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : null
      } catch (error) {
        console.warn('localStorage.getItem failed:', error)
        return null
      }
    },
    remove: (key: string) => {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.warn('localStorage.removeItem failed:', error)
      }
    },
  },
}

// Network Optimization
export const networkUtils = {
  // Connection quality detection
  getConnectionInfo: () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      }
    }
    return null
  },

  // Adaptive loading based on connection
  shouldLoadHighQuality: () => {
    const connection = networkUtils.getConnectionInfo()
    if (!connection) return true
    
    // Load high quality on fast connections
    return connection.effectiveType === '4g' && !connection.saveData
  },

  // Preload critical resources
  preloadResource: (url: string, as: string) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = url
    link.as = as
    document.head.appendChild(link)
  },

  // Prefetch next page resources
  prefetchResource: (url: string) => {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    document.head.appendChild(link)
  },
}

// Testing Utilities
export const testingUtils = {
  // Visual regression testing helpers
  captureScreenshot: async (element: HTMLElement) => {
    if ('html2canvas' in window) {
      const html2canvas = (window as any).html2canvas
      return await html2canvas(element)
    }
    return null
  },

  // Performance testing
  measureRenderTime: (componentName: string, renderFn: () => void) => {
    const startTime = performance.now()
    renderFn()
    const endTime = performance.now()
    
    console.log(`${componentName} render time: ${endTime - startTime}ms`)
    return endTime - startTime
  },

  // Accessibility testing helpers
  checkAccessibility: (element: HTMLElement) => {
    const issues: string[] = []
    
    // Check for missing alt text on images
    const images = element.querySelectorAll('img:not([alt])')
    if (images.length > 0) {
      issues.push(`${images.length} images missing alt text`)
    }
    
    // Check for missing labels on form inputs
    const inputs = element.querySelectorAll('input:not([aria-label]):not([aria-labelledby])')
    inputs.forEach((input) => {
      const id = input.getAttribute('id')
      if (!id || !element.querySelector(`label[for="${id}"]`)) {
        issues.push(`Input missing label: ${input.outerHTML}`)
      }
    })
    
    // Check for proper heading hierarchy
    const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    let previousLevel = 0
    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.charAt(1))
      if (level > previousLevel + 1) {
        issues.push(`Heading level skip: ${heading.outerHTML}`)
      }
      previousLevel = level
    })
    
    return issues
  },
}

// Performance optimization recommendations
export const optimizationRecommendations = {
  // Image optimization
  images: [
    'Use WebP format for better compression',
    'Implement lazy loading for images below the fold',
    'Use responsive images with srcset',
    'Optimize image dimensions for actual display size',
  ],
  
  // JavaScript optimization
  javascript: [
    'Implement code splitting for route-based chunks',
    'Use dynamic imports for non-critical components',
    'Minimize and compress JavaScript bundles',
    'Remove unused code with tree shaking',
  ],
  
  // CSS optimization
  css: [
    'Use critical CSS for above-the-fold content',
    'Minimize and compress CSS files',
    'Remove unused CSS rules',
    'Use CSS containment for better rendering performance',
  ],
  
  // Network optimization
  network: [
    'Enable HTTP/2 server push for critical resources',
    'Use CDN for static assets',
    'Implement proper caching headers',
    'Minimize HTTP requests',
  ],
}

export default {
  imageUtils,
  codeSpittingUtils,
  performanceUtils,
  bundleUtils,
  cachingUtils,
  networkUtils,
  testingUtils,
  optimizationRecommendations,
}