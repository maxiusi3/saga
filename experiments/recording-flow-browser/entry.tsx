import React from 'react'
import { createRoot } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import ProjectRecordPage from '@/app/[locale]/dashboard/projects/[id]/record/page'
import { recorderDB } from '@/lib/recorder-db'
import { saveLocalRecording } from '@/lib/recording-save-flow'
import { useAuthStore } from './boundaries'
import recording from '../../packages/web/public/locales/en/recording.json'
import stories from '../../packages/web/public/locales/en/stories.json'

Object.assign(window, { flowFixture: { recorderDB, useAuthStore, saveLocalRecording } })
createRoot(document.getElementById('root')!).render(
  <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ recording, stories }}>
    <ProjectRecordPage />
  </NextIntlClientProvider>,
)
