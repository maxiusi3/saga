import React from 'react'
import { createRoot } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import { Toaster } from 'react-hot-toast'
import ProjectDetailClient from '@/app/[locale]/dashboard/projects/[id]/ProjectDetailClient'
import projects from '../../packages/web/public/locales/en/projects.json'
import common from '../../packages/web/public/locales/en/common.json'
createRoot(document.getElementById('root')!).render(<NextIntlClientProvider locale="en" timeZone="UTC" messages={{projects,common}}>
  <Toaster /><ProjectDetailClient mediaAssetsEnabled />
</NextIntlClientProvider>)
