import { create } from 'zustand'
import { apiClient } from '@/lib/api'

interface ExportRequest {
  id: string
  projectId: string
  facilitatorId: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  downloadUrl?: string
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
  project?: {
    id: string
    title: string
  }
}

interface ExportState {
  exports: ExportRequest[]
  isLoading: boolean
  error: string | null
}

interface ExportActions {
  fetchExports: () => Promise<void>
  createExport: (projectId: string, format?: string) => Promise<ExportRequest>
  downloadExport: (exportId: string, filename: string) => Promise<void>
  getExport: (exportId: string) => Promise<ExportRequest>
  clearError: () => void
  setLoading: (loading: boolean) => void
}

type ExportStore = ExportState & ExportActions

export const useExportStore = create<ExportStore>((set, get) => ({
  // Initial state
  exports: [],
  isLoading: false,
  error: null,

  // Actions
  fetchExports: async () => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.exports.list()
      const exports = response.data.data

      set({
        exports,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch exports',
      })
    }
  },

  createExport: async (projectId: string, format: string = 'zip') => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.exports.create(projectId, format)
      const newExport = response.data.data

      set((state) => ({
        exports: [newExport, ...state.exports],
        isLoading: false,
        error: null,
      }))

      return newExport
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to create export',
      })
      throw error
    }
  },

  downloadExport: async (exportId: string, filename: string) => {
    try {
      const response = await apiClient.exports.download(exportId)
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to download export',
      })
      throw error
    }
  },

  getExport: async (exportId: string) => {
    try {
      const response = await apiClient.exports.get(exportId)
      const exportData = response.data.data

      // Update the export in the list if it exists
      set((state) => ({
        exports: state.exports.map(exp => 
          exp.id === exportId ? exportData : exp
        ),
      }))

      return exportData
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch export',
      })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },
}))

// Selectors
export const useExports = () => useExportStore(state => state.exports)
export const useExportLoading = () => useExportStore(state => state.isLoading)
export const useExportError = () => useExportStore(state => state.error)

// Helper function to get exports for a specific project
export const useProjectExports = (projectId: string) => 
  useExportStore(state => state.exports.filter(exp => exp.projectId === projectId))

// Helper function to check if an export is ready for download
export const isExportReady = (exportReq: ExportRequest) => 
  exportReq.status === 'ready' && (!exportReq.expiresAt || new Date(exportReq.expiresAt) > new Date())

// Helper function to get export status display info
export const getExportStatusInfo = (status: string) => {
  switch (status) {
    case 'ready':
      return { color: 'bg-green-100 text-green-800', text: 'Ready for Download' }
    case 'processing':
      return { color: 'bg-yellow-100 text-yellow-800', text: 'Processing' }
    case 'pending':
      return { color: 'bg-blue-100 text-blue-800', text: 'Pending' }
    case 'failed':
      return { color: 'bg-red-100 text-red-800', text: 'Failed' }
    default:
      return { color: 'bg-gray-100 text-gray-800', text: status }
  }
}