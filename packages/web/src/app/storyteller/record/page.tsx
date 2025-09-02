'use client'

import { Suspense } from 'react'

function RecordPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Record Page</h1>
        <p>Simplified version for testing build</p>
      </div>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    }>
      <RecordPageContent />
    </Suspense>
  );
}
