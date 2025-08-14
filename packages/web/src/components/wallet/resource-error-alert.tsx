'use client'

import Link from 'next/link'
import { ResourceValidationError, ResourceValidationService } from '@/lib/resource-validation'

interface ResourceErrorAlertProps {
  errors: ResourceValidationError[]
  title?: string
  className?: string
  showActions?: boolean
}

export function ResourceErrorAlert({ 
  errors, 
  title = 'Insufficient Resources',
  className = '',
  showActions = true
}: ResourceErrorAlertProps) {
  if (errors.length === 0) return null

  const message = ResourceValidationService.formatErrorMessage(errors)
  const actions = showActions ? ResourceValidationService.getSuggestedActions(errors) : []

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-amber-800">
            {title}
          </h3>
          <div className="mt-2 text-sm text-amber-700">
            <p>{message}</p>
            
            {errors.length > 1 && (
              <div className="mt-3">
                <p className="font-medium mb-2">Details:</p>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-xs">
                      {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {showActions && actions.length > 0 && (
            <div className="mt-4">
              <div className="flex space-x-3">
                {actions.map((action, index) => (
                  <Link
                    key={index}
                    href={action.href}
                    className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${
                      action.primary
                        ? 'text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500'
                        : 'text-amber-700 bg-transparent hover:bg-amber-50'
                    }`}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ResourceRequirementDisplay({ 
  requirements,
  wallet,
  className = ''
}: {
  requirements: { [key: string]: number }
  wallet: any
  className?: string
}) {
  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
      <h4 className="text-sm font-medium text-gray-900 mb-3">Resource Requirements</h4>
      <div className="space-y-2">
        {Object.entries(requirements).map(([resourceType, required]) => {
          const available = wallet?.[resourceType] || 0
          const sufficient = available >= required
          const displayName = ResourceValidationService.getResourceDisplayName(
            resourceType as any, 
            required
          )
          
          return (
            <div key={resourceType} className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${sufficient ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-gray-600">{displayName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`font-medium ${sufficient ? 'text-green-600' : 'text-red-600'}`}>
                  {available}
                </span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-600">{required}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}