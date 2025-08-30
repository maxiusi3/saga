'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusManagement, useAnnouncement } from './skip-links'

interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = '',
  closeOnOverlayClick = true,
  closeOnEscape = true
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const { trapFocus, setFocus, restoreFocus } = useFocusManagement()
  const { announce } = useAnnouncement()

  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Announce modal opening
      announce(`${title} dialog opened`, 'assertive')
      
      // Set focus to modal
      setFocus(modalRef.current)
      
      // Trap focus within modal
      const cleanup = trapFocus(modalRef.current)
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
      
      return () => {
        cleanup()
        document.body.style.overflow = ''
        restoreFocus()
      }
    }
  }, [isOpen, title, announce, setFocus, trapFocus, restoreFocus])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, closeOnEscape])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto focus:outline-none ${className}`}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="touch-target text-gray-400 hover:text-gray-600 focus-visible"
            aria-label="Close dialog"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Description */}
        {description && (
          <div className="px-6 pt-4">
            <p id="modal-description" className="text-sm text-gray-600">
              {description}
            </p>
          </div>
        )}
        
        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

// Accessible confirmation dialog
interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info'
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: (
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          confirmClass: 'bg-red-600 hover:bg-red-700 text-white'
        }
      case 'warning':
        return {
          icon: (
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          confirmClass: 'bg-yellow-600 hover:bg-yellow-700 text-white'
        }
      default:
        return {
          icon: (
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white'
        }
    }
  }

  const { icon, confirmClass } = getVariantStyles()

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className="max-w-md"
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-700 mb-6">
            {message}
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="btn-outline touch-target"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`btn touch-target ${confirmClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </AccessibleModal>
  )
}
