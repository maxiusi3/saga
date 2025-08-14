export interface ApiResponse<T = any> {
  data: T
  message?: string
  timestamp: string
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
  path: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}