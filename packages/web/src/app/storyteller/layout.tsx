import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Your Story Space - Saga',
  description: 'Share your memories and stories with your family',
}

export default function StorytellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className=\"storyteller-layout\">
      {/* Simple header for storytellers */}
      <header className=\"bg-white shadow-sm border-b\">
        <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8\">
          <div className=\"flex justify-between items-center h-16\">
            <div className=\"flex items-center\">
              <h1 className=\"text-xl font-bold text-gray-900\">
                Saga Stories
              </h1>
            </div>
            <div className=\"flex items-center space-x-4\">
              <a 
                href=\"/storyteller/help\" 
                className=\"text-gray-600 hover:text-gray-900 font-medium\"
              >
                Help
              </a>
              <a 
                href=\"/auth/signout\" 
                className=\"text-gray-600 hover:text-gray-900 font-medium\"
              >
                Sign Out
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className=\"min-h-screen bg-gray-50\">
        {children}
      </main>

      {/* Simple footer */}
      <footer className=\"bg-white border-t\">
        <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6\">
          <div className=\"text-center text-sm text-gray-500\">
            <p>Need help? Contact your family member or email support@saga.family</p>
          </div>
        </div>
      </footer>
    </div>
  )
}