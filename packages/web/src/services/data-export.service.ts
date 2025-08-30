import { api } from '@/lib/api'

export interface ExportRequest {
  projectId: string
  format: 'zip' | 'json'
  includeAudio: boolean
  includePhotos: boolean
  includeTranscripts: boolean
  includeInteractions: boolean
}

export interface ExportStatus {
  id: string
  projectId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  downloadUrl?: string
  expiresAt?: string
  createdAt: string
  error?: string
}

export interface ProjectExportData {
  metadata: {
    projectId: string
    projectName: string
    description?: string
    createdAt: string
    exportedAt: string
    version: string
    totalStories: number
    totalDuration: number
    participants: Array<{
      id: string
      name: string
      role: 'facilitator' | 'storyteller'
      joinedAt: string
    }>
  }
  stories: Array<{
    id: string
    title: string
    storyteller: {
      id: string
      name: string
    }
    createdAt: string
    duration: number
    status: 'recorded' | 'transcribed' | 'reviewed'
    audioUrl?: string
    transcript?: string
    photos?: Array<{
      id: string
      url: string
      caption?: string
    }>
    interactions: Array<{
      id: string
      type: 'comment' | 'follow_up' | 'edit'
      author: {
        id: string
        name: string
        role: 'facilitator' | 'storyteller'
      }
      content: string
      createdAt: string
    }>
  }>
}

class DataExportService {
  /**
   * Request a full project export
   */
  async requestExport(request: ExportRequest): Promise<{ exportId: string }> {
    try {
      const response = await api.post('/exports/request', request)
      return response.data
    } catch (error) {
      console.error('Failed to request export:', error)
      throw new Error('Failed to request export')
    }
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<ExportStatus> {
    try {
      const response = await api.get(`/exports/${exportId}/status`)
      return response.data
    } catch (error) {
      console.error('Failed to get export status:', error)
      throw new Error('Failed to get export status')
    }
  }

  /**
   * Get all exports for a project
   */
  async getProjectExports(projectId: string): Promise<ExportStatus[]> {
    try {
      const response = await api.get(`/projects/${projectId}/exports`)
      return response.data
    } catch (error) {
      console.error('Failed to get project exports:', error)
      throw new Error('Failed to get project exports')
    }
  }

  /**
   * Cancel an export request
   */
  async cancelExport(exportId: string): Promise<void> {
    try {
      await api.delete(`/exports/${exportId}`)
    } catch (error) {
      console.error('Failed to cancel export:', error)
      throw new Error('Failed to cancel export')
    }
  }

  /**
   * Download export file
   */
  async downloadExport(exportId: string): Promise<void> {
    try {
      const response = await api.get(`/exports/${exportId}/download`, {
        responseType: 'blob'
      })
      
      // Create download link
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `saga-export-${exportId}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download export:', error)
      throw new Error('Failed to download export')
    }
  }

  /**
   * Get project data for preview (without files)
   */
  async getProjectData(projectId: string): Promise<ProjectExportData> {
    try {
      const response = await api.get(`/projects/${projectId}/export-data`)
      return response.data
    } catch (error) {
      console.error('Failed to get project data:', error)
      throw new Error('Failed to get project data')
    }
  }

  /**
   * Validate export request
   */
  validateExportRequest(request: ExportRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!request.projectId) {
      errors.push('Project ID is required')
    }

    if (!request.format) {
      errors.push('Export format is required')
    }

    if (!request.includeAudio && !request.includePhotos && !request.includeTranscripts && !request.includeInteractions) {
      errors.push('At least one content type must be included')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Estimate export size
   */
  async estimateExportSize(request: ExportRequest): Promise<{ estimatedSizeMB: number; estimatedDuration: string }> {
    try {
      const response = await api.post('/exports/estimate', request)
      return response.data
    } catch (error) {
      console.error('Failed to estimate export size:', error)
      return { estimatedSizeMB: 0, estimatedDuration: 'Unknown' }
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
  }

  /**
   * Get export file structure preview
   */
  getExportStructurePreview(projectName: string): string {
    return `
${projectName}.zip
├── metadata.json
└── stories/
    └── [YYYY-MM-DD_Story-Title]/
        ├── audio.webm
        ├── transcript.txt
        ├── photo.jpg
        └── interactions.json
    `.trim()
  }
}

export const dataExportService = new DataExportService()
