'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { Badge } from '@/components/ui/badge'
import { 
  Eye, 
  Type, 
  Contrast, 
  Volume2, 
  MousePointer, 
  Keyboard,
  Settings,
  RotateCcw
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface AccessibilitySettings {
  highContrast: boolean
  largeText: boolean
  reducedMotion: boolean
  screenReaderOptimized: boolean
  keyboardNavigation: boolean
  audioDescriptions: boolean
  fontSize: 'small' | 'medium' | 'large' | 'extra-large'
  colorScheme: 'auto' | 'light' | 'dark' | 'high-contrast'
}

interface AccessibilitySettingsProps {
  className?: string
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  screenReaderOptimized: false,
  keyboardNavigation: true,
  audioDescriptions: false,
  fontSize: 'medium',
  colorScheme: 'auto'
}

export function AccessibilitySettingsComponent({ className }: AccessibilitySettingsProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

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
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings })
      }
    } catch (error) {
      console.error('Error loading accessibility settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = (newSettings: AccessibilitySettings) => {
    try {
      localStorage.setItem('accessibility-settings', JSON.stringify(newSettings))
      setSettings(newSettings)
      toast.success('Accessibility settings saved')
    } catch (error) {
      console.error('Error saving accessibility settings:', error)
      toast.error('Failed to save settings')
    }
  }

  const applySettings = (settings: AccessibilitySettings) => {
    const root = document.documentElement

    // 应用字体大小
    root.style.setProperty('--font-size-multiplier', getFontSizeMultiplier(settings.fontSize))

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

    // 应用颜色方案
    root.setAttribute('data-color-scheme', settings.colorScheme)

    // 应用键盘导航优化
    if (settings.keyboardNavigation) {
      root.classList.add('keyboard-navigation')
    } else {
      root.classList.remove('keyboard-navigation')
    }

    // 应用屏幕阅读器优化
    if (settings.screenReaderOptimized) {
      root.classList.add('screen-reader-optimized')
    } else {
      root.classList.remove('screen-reader-optimized')
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

  const resetToDefaults = () => {
    saveSettings(DEFAULT_SETTINGS)
    toast.success('Settings reset to defaults')
  }

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value }
    saveSettings(newSettings)
  }

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Accessibility Settings
          </h3>
          <Badge variant="outline" className="text-xs">
            WCAG 2.1 AA
          </Badge>
        </div>

        {/* Visual Settings */}
        <div className="space-y-4">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Type className="h-4 w-4" />
            Visual
          </h4>
          
          <div className="space-y-4 pl-6">
            {/* Font Size */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Font Size</Label>
                <p className="text-sm text-muted-foreground">Adjust text size for better readability</p>
              </div>
              <select
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', e.target.value as any)}
                className="px-3 py-2 border border-border rounded-md bg-background"
                aria-label="Font size selection"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="extra-large">Extra Large</option>
              </select>
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">High Contrast</Label>
                <p className="text-sm text-muted-foreground">Increase contrast for better visibility</p>
              </div>
              <Switch
                checked={settings.highContrast}
                onCheckedChange={(checked) => updateSetting('highContrast', checked)}
                aria-label="Toggle high contrast mode"
              />
            </div>

            {/* Large Text */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Large Text</Label>
                <p className="text-sm text-muted-foreground">Increase text size throughout the app</p>
              </div>
              <Switch
                checked={settings.largeText}
                onCheckedChange={(checked) => updateSetting('largeText', checked)}
                aria-label="Toggle large text mode"
              />
            </div>

            {/* Color Scheme */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Color Scheme</Label>
                <p className="text-sm text-muted-foreground">Choose your preferred color theme</p>
              </div>
              <select
                value={settings.colorScheme}
                onChange={(e) => updateSetting('colorScheme', e.target.value as any)}
                className="px-3 py-2 border border-border rounded-md bg-background"
                aria-label="Color scheme selection"
              >
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="high-contrast">High Contrast</option>
              </select>
            </div>
          </div>
        </div>

        {/* Motion Settings */}
        <div className="space-y-4">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <MousePointer className="h-4 w-4" />
            Motion & Interaction
          </h4>
          
          <div className="space-y-4 pl-6">
            {/* Reduced Motion */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Reduce Motion</Label>
                <p className="text-sm text-muted-foreground">Minimize animations and transitions</p>
              </div>
              <Switch
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
                aria-label="Toggle reduced motion"
              />
            </div>

            {/* Keyboard Navigation */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Enhanced Keyboard Navigation</Label>
                <p className="text-sm text-muted-foreground">Improve keyboard focus indicators</p>
              </div>
              <Switch
                checked={settings.keyboardNavigation}
                onCheckedChange={(checked) => updateSetting('keyboardNavigation', checked)}
                aria-label="Toggle enhanced keyboard navigation"
              />
            </div>
          </div>
        </div>

        {/* Screen Reader Settings */}
        <div className="space-y-4">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Screen Reader
          </h4>
          
          <div className="space-y-4 pl-6">
            {/* Screen Reader Optimized */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Screen Reader Optimization</Label>
                <p className="text-sm text-muted-foreground">Optimize interface for screen readers</p>
              </div>
              <Switch
                checked={settings.screenReaderOptimized}
                onCheckedChange={(checked) => updateSetting('screenReaderOptimized', checked)}
                aria-label="Toggle screen reader optimization"
              />
            </div>

            {/* Audio Descriptions */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Audio Descriptions</Label>
                <p className="text-sm text-muted-foreground">Enable audio descriptions for media</p>
              </div>
              <Switch
                checked={settings.audioDescriptions}
                onCheckedChange={(checked) => updateSetting('audioDescriptions', checked)}
                aria-label="Toggle audio descriptions"
              />
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <div className="pt-4 border-t border-border">
          <FurbridgeButton 
            onClick={resetToDefaults}
            variant="outline"
            className="w-full"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </FurbridgeButton>
        </div>
      </div>
    </Card>
  )
}
