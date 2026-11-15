import React from 'react'
import { createRoot } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import NotificationsPage from '../../packages/web/src/app/[locale]/dashboard/notifications/page'
import messages from '../../packages/web/public/locales/en/notifications-page.json'
createRoot(document.getElementById('root')!).render(<NextIntlClientProvider locale="en" messages={{'notifications-page':messages}}><main className="mx-auto max-w-6xl p-6"><NotificationsPage /></main></NextIntlClientProvider>)
