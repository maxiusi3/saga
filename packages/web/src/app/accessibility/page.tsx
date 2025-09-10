'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, Info } from 'lucide-react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AccessibilitySettingsComponent } from '@/components/accessibility/accessibility-settings'

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <FurbridgeButton variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </FurbridgeButton>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Eye className="h-8 w-8" />
              Accessibility Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Customize your experience to meet your accessibility needs
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            WCAG 2.1 AA
          </Badge>
        </div>

        {/* Information Card */}
        <Card className="p-6 mb-8 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                About Accessibility Features
              </h3>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>
                  Saga is designed to be accessible to everyone. Our accessibility features follow 
                  Web Content Accessibility Guidelines (WCAG) 2.1 AA standards.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>High contrast mode for better visibility</li>
                  <li>Adjustable text sizes for improved readability</li>
                  <li>Reduced motion options for users sensitive to animations</li>
                  <li>Enhanced keyboard navigation support</li>
                  <li>Screen reader optimizations</li>
                  <li>Audio descriptions for media content</li>
                </ul>
                <p className="mt-3">
                  <strong>Quick Access:</strong> Use the accessibility toolbar (eye icon) in the 
                  bottom-right corner for quick toggles, or use this page for detailed settings.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Accessibility Settings Component */}
        <AccessibilitySettingsComponent />

        {/* Keyboard Shortcuts Card */}
        <Card className="p-6 mt-8">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs">⌨️</kbd>
            Keyboard Shortcuts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Skip to main content</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Tab</kbd>
              </div>
              <div className="flex justify-between">
                <span>Navigate between elements</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Tab / Shift+Tab</kbd>
              </div>
              <div className="flex justify-between">
                <span>Activate button/link</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter / Space</kbd>
              </div>
              <div className="flex justify-between">
                <span>Close modal/dialog</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Escape</kbd>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Navigate dropdown</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">↑ ↓</kbd>
              </div>
              <div className="flex justify-between">
                <span>Select dropdown option</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd>
              </div>
              <div className="flex justify-between">
                <span>Toggle checkbox</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd>
              </div>
              <div className="flex justify-between">
                <span>Navigate radio buttons</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">↑ ↓ ← →</kbd>
              </div>
            </div>
          </div>
        </Card>

        {/* Browser Settings Card */}
        <Card className="p-6 mt-8">
          <h3 className="font-semibold text-foreground mb-4">
            Browser & System Settings
          </h3>
          <div className="text-sm text-muted-foreground space-y-3">
            <p>
              For the best accessibility experience, consider adjusting your browser and system settings:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-foreground mb-2">Browser Settings</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Enable high contrast mode</li>
                  <li>• Increase default font size</li>
                  <li>• Enable reader mode</li>
                  <li>• Configure zoom level</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">System Settings</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Enable screen reader</li>
                  <li>• Configure voice control</li>
                  <li>• Adjust display contrast</li>
                  <li>• Enable sticky keys</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Support Card */}
        <Card className="p-6 mt-8">
          <h3 className="font-semibold text-foreground mb-4">
            Need Help?
          </h3>
          <div className="text-sm text-muted-foreground space-y-3">
            <p>
              If you're experiencing accessibility issues or need additional accommodations, 
              we're here to help.
            </p>
            <div className="flex flex-wrap gap-3">
              <FurbridgeButton variant="outline" size="sm" asChild>
                <a href="mailto:accessibility@saga.family">
                  Contact Accessibility Team
                </a>
              </FurbridgeButton>
              <FurbridgeButton variant="outline" size="sm" asChild>
                <Link href="/help/accessibility">
                  Accessibility Guide
                </Link>
              </FurbridgeButton>
              <FurbridgeButton variant="outline" size="sm" asChild>
                <a 
                  href="https://www.w3.org/WAI/WCAG21/quickref/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  WCAG Guidelines
                </a>
              </FurbridgeButton>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
