'use client'

import React, { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { 
  Eye, 
  Type, 
  Contrast, 
  MousePointer, 
  Settings,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface AccessibilitySettings {
  highContrast: boolean
  largeText: boolean
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large' | 'extra-large'
}

interface AccessibilityToolbarProps {
  className?: string
}

export function AccessibilityToolbar({ className }: AccessibilityToolbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    fontSize: 'medium'
  })

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    applySettings(settings)
  }, [settings])

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('accessibility-settings')
      if (saved) {
        const parsedSettings = JSON.parse(saved)
        setSettings(prev => ({ ...prev, ...parsedSettings }))
      }
    } catch (error) {
      console.error('Error loading accessibility settings:', error)
    }
  }

  const saveSettings = (newSettings: AccessibilitySettings) => {
    try {
      const fullSettings = {
        ...JSON.parse(localStorage.getItem('accessibility-settings') || '{}'),
        ...newSettings
      }
      localStorage.setItem('accessibility-settings', JSON.stringify(fullSettings))
      setSettings(newSettings)
    } catch (error) {
      console.error('Error saving accessibility settings:', error)
    }
  }

  const applySettings = (settings: AccessibilitySettings) => {
    const root = document.documentElement

    // 应用字体大小
    const fontSizeMultiplier = getFontSizeMultiplier(settings.fontSize)
    root.style.setProperty('--font-size-multiplier', fontSizeMultiplier)

    // 应用高对比度
    if (settings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    // 应用减少动画
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }

    // 应用大文本
    if (settings.largeText) {
      root.classList.add('large-text')
    } else {
      root.classList.remove('large-text')
    }
  }

  const getFontSizeMultiplier = (fontSize: string) => {
    switch (fontSize) {
      case 'small': return '0.875'
      case 'medium': return '1'
      case 'large': return '1.125'
      case 'extra-large': return '1.25'
      default: return '1'
    }
  }

  const toggleSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value }
    saveSettings(newSettings)
    
    // 提供反馈
    const settingNames = {
      highContrast: 'High Contrast',
      largeText: 'Large Text',
      reducedMotion: 'Reduced Motion',
      fontSize: 'Font Size'
    }
    
    toast.success(`${settingNames[key]} ${typeof value === 'boolean' ? (value ? 'enabled' : 'disabled') : 'updated'}`)
  }

  const cycleFontSize = () => {
    const sizes: Array<AccessibilitySettings['fontSize']> = ['small', 'medium', 'large', 'extra-large']
    const currentIndex = sizes.indexOf(settings.fontSize)
    const nextIndex = (currentIndex + 1) % sizes.length
    toggleSetting('fontSize', sizes[nextIndex])
  }

  return (
    <>
      {/* Skip Link */}
      <a 
        href="#main-content" 
        className="skip-link"
        onFocus={() => setIsOpen(true)}
      >
        Skip to main content
      </a>

      {/* Accessibility Toolbar */}
      <div 
        className={`fixed bottom-4 right-4 z-50 ${className}`}
        role="toolbar"
        aria-label="Accessibility tools"
      >
        {/* Toggle Button */}
        <FurbridgeButton
          onClick={() => setIsOpen(!isOpen)}
          className="mb-2 rounded-full w-12 h-12 shadow-lg"
          variant="default"
          aria-label={isOpen ? "Close accessibility toolbar" : "Open accessibility toolbar"}
          aria-expanded={isOpen}
          aria-controls="accessibility-toolbar-content"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </FurbridgeButton>

        {/* Toolbar Content */}
        {isOpen && (
          <div 
            id="accessibility-toolbar-content"
            className="bg-background border border-border rounded-lg shadow-lg p-4 space-y-3 min-w-[200px]"
            role="group"
            aria-label="Accessibility settings"
          >
            <div className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Quick Access
            </div>

            {/* High Contrast Toggle */}
            <FurbridgeButton
              onClick={() => toggleSetting('highContrast', !settings.highContrast)}
              variant={settings.highContrast ? "default" : "outline"}
              size="sm"
              className="w-full justify-start"
              aria-pressed={settings.highContrast}
              aria-label={`${settings.highContrast ? 'Disable' : 'Enable'} high contrast mode`}
            >
              <Contrast className="h-4 w-4 mr-2" />
              High Contrast
            </FurbridgeButton>

            {/* Large Text Toggle */}
            <FurbridgeButton
              onClick={() => toggleSetting('largeText', !settings.largeText)}
              variant={settings.largeText ? "default" : "outline"}
              size="sm"
              className="w-full justify-start"
              aria-pressed={settings.largeText}
              aria-label={`${settings.largeText ? 'Disable' : 'Enable'} large text mode`}
            >
              <Type className="h-4 w-4 mr-2" />
              Large Text
            </FurbridgeButton>

            {/* Font Size Cycler */}
            <FurbridgeButton
              onClick={cycleFontSize}
              variant="outline"
              size="sm"
              className="w-full justify-between"
              aria-label={`Current font size: ${settings.fontSize}. Click to cycle to next size.`}
            >
              <span className="flex items-center">
                <Type className="h-4 w-4 mr-2" />
                Font: {settings.fontSize}
              </span>
              <ChevronUp className="h-3 w-3" />
            </FurbridgeButton>

            {/* Reduced Motion Toggle */}
            <FurbridgeButton
              onClick={() => toggleSetting('reducedMotion', !settings.reducedMotion)}
              variant={settings.reducedMotion ? "default" : "outline"}
              size="sm"
              className="w-full justify-start"
              aria-pressed={settings.reducedMotion}
              aria-label={`${settings.reducedMotion ? 'Disable' : 'Enable'} reduced motion mode`}
            >
              <MousePointer className="h-4 w-4 mr-2" />
              Reduce Motion
            </FurbridgeButton>

            {/* Divider */}
            <div className="border-t border-border pt-2">
              <p className="text-xs text-muted-foreground text-center">
                WCAG 2.1 AA Compliant
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Screen Reader Announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-announcement"
        id="accessibility-announcements"
      />
    </>
  )
}

// Hook for managing accessibility settings
export function useAccessibilitySettings() {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    fontSize: 'medium'
  })

  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('accessibility-settings')
        if (saved) {
          const parsedSettings = JSON.parse(saved)
          setSettings(prev => ({ ...prev, ...parsedSettings }))
        }
      } catch (error) {
        console.error('Error loading accessibility settings:', error)
      }
    }

    loadSettings()
  }, [])

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value }
    try {
      const fullSettings = {
        ...JSON.parse(localStorage.getItem('accessibility-settings') || '{}'),
        ...newSettings
      }
      localStorage.setItem('accessibility-settings', JSON.stringify(fullSettings))
      setSettings(newSettings)
    } catch (error) {
      console.error('Error saving accessibility settings:', error)
    }
  }

  return { settings, updateSetting }
}
