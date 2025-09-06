'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface MobileRecordingOptimizerProps {
  children: React.ReactNode
  className?: string
}

export function MobileRecordingOptimizer({ children, className = '' }: MobileRecordingOptimizerProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isLandscape, setIsLandscape] = useState(false)
  const [showMobileOptimizations, setShowMobileOptimizations] = useState(false)
  const [wakeLockSupported, setWakeLockSupported] = useState(false)
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone']
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword)) || 
                            window.innerWidth <= 768
      
      setIsMobile(isMobileDevice)
      
      // Check orientation
      setIsLandscape(window.innerWidth > window.innerHeight)
      
      if (isMobileDevice) {
        setShowMobileOptimizations(true)
      }
    }

    // Check wake lock support
    if ('wakeLock' in navigator) {
      setWakeLockSupported(true)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    window.addEventListener('orientationchange', checkMobile)

    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('orientationchange', checkMobile)
      releaseWakeLock()
    }
  }, [])

  const requestWakeLock = async () => {
    if (wakeLockSupported && !wakeLock) {
      try {
        const lock = await navigator.wakeLock.request('screen')
        setWakeLock(lock)
        
        lock.addEventListener('release', () => {
          setWakeLock(null)
        })
      } catch (error) {
        console.error('Failed to request wake lock:', error)
      }
    }
  }

  const releaseWakeLock = () => {
    if (wakeLock) {
      wakeLock.release()
      setWakeLock(null)
    }
  }

  const optimizeForRecording = () => {
    // Request wake lock to prevent screen from turning off
    requestWakeLock()
    
    // Hide address bar on mobile browsers
    if (isMobile) {
      setTimeout(() => {
        window.scrollTo(0, 1)
      }, 100)
    }
    
    // Prevent zoom on double tap
    const viewport = document.querySelector('meta[name=viewport]')
    if (viewport && isMobile) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    }
  }

  const restoreNormalMode = () => {
    releaseWakeLock()
    
    // Restore normal viewport settings
    const viewport = document.querySelector('meta[name=viewport]')
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0')
    }
  }

  if (!isMobile || !showMobileOptimizations) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={`mobile-recording-optimizer ${className}`}>
      {/* Mobile-specific tips */}
      <Card className="p-4 mb-4 bg-primary/10 border-primary/20">
        <h3 className="font-bold text-primary mb-2">📱 Mobile Recording Tips</h3>
        <div className="text-sm text-primary/90 space-y-1">
          <p>• Hold your phone close to your mouth (6-8 inches)</p>
          <p>• Find a quiet room to reduce background noise</p>
          <p>• Keep your phone charged or plugged in</p>
          {!isLandscape && <p>• Consider rotating to landscape for larger buttons</p>}
          {wakeLockSupported && (
            <p>• We'll keep your screen on during recording</p>
          )}
        </div>
      </Card>

      {/* Orientation suggestion */}
      {!isLandscape && (
        <Card className="p-4 mb-4 bg-yellow-500/10 border-yellow-500/20">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🔄</div>
            <div>
              <h4 className="font-bold text-yellow-500">Better Experience Available</h4>
              <p className="text-sm text-yellow-500/90">
                Rotate your device to landscape mode for larger buttons and better controls.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Recording optimization controls */}
      <Card className="p-4 mb-4 bg-success/10 border-success/20">
        <h4 className="font-bold text-success-foreground mb-3">Recording Optimization</h4>
        <div className="flex flex-col space-y-2">
          <Button
            onClick={optimizeForRecording}
            size="sm"
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            🎯 Optimize for Recording
          </Button>
          <div className="text-xs text-success-foreground/90">
            This will keep your screen on and hide distractions during recording.
          </div>
        </div>
      </Card>

      {/* Main content with mobile-optimized styling */}
      <div className="mobile-optimized-content">
        {children}
      </div>

      {/* Mobile-specific styles */}
      <style jsx>{`
        .mobile-recording-optimizer {
          padding: 1rem;
        }
        
        .mobile-optimized-content {
          /* Larger touch targets for mobile */
        }
        
        .mobile-optimized-content button {
          min-height: 44px;
          min-width: 44px;
          font-size: 16px; /* Prevent zoom on iOS */
        }
        
        .mobile-optimized-content input,
        .mobile-optimized-content select,
        .mobile-optimized-content textarea {
          font-size: 16px; /* Prevent zoom on iOS */
        }
        
        @media (max-width: 768px) {
          .mobile-recording-optimizer {
            padding: 0.5rem;
          }
        }
        
        @media (orientation: landscape) and (max-height: 500px) {
          .mobile-recording-optimizer {
            padding: 0.25rem;
          }
        }
      `}</style>
    </div>
  )
}