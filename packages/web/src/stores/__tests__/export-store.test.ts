import { renderHook, act } from '@testing-library/react'
import { useExportStore, getExportStatusInfo, isExportReady } from '../export-store'
import { apiClient } from '@/lib/api'

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    exports: {
      list: jest.fn(),
      create: jest.fn(),
      download: jest.fn(),
      get: jest.fn(),
    },
  },
}))

// Mock URL.createObjectURL and related APIs
global.URL.createObjectURL = jest.fn(() => 'mock-url')
global.URL.revokeObjectURL = jest.fn()

describe('ExportStore', () => {
  beforeEach(() => {
    // Reset the store state
    useExportStore.setState({
      exports: [],
      isLoading: false,
      error: null,
    })
    
    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('fetchExports', () => {
    it('should fetch exports successfully', async () => {
      const mockExports = [
        {
          id: '1',
          projectId: 'project1',
          status: 'ready',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      ;(apiClient.exports.list as jest.Mock).mockResolvedValue({
        data: { data: mockExports },
      })

      const { result } = renderHook(() => useExportStore())

      await act(async () => {
        await result.current.fetchExports()
      })

      expect(result.current.exports).toEqual(mockExports)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle fetch exports error', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Failed to fetch exports',
            },
          },
        },
      }

      ;(apiClient.exports.list as jest.Mock).mockRejectedValue(mockError)

      const { result } = renderHook(() => useExportStore())

      await act(async () => {
        await result.current.fetchExports()
      })

      expect(result.current.exports).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Failed to fetch exports')
    })
  })

  describe('createExport', () => {
    it('should create export successfully', async () => {
      const mockExport = {
        id: '1',
        projectId: 'project1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(apiClient.exports.create as jest.Mock).mockResolvedValue({
        data: { data: mockExport },
      })

      const { result } = renderHook(() => useExportStore())

      let createdExport
      await act(async () => {
        createdExport = await result.current.createExport('project1')
      })

      expect(createdExport).toEqual(mockExport)
      expect(result.current.exports).toContain(mockExport)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(apiClient.exports.create).toHaveBeenCalledWith('project1', 'zip')
    })

    it('should create export with custom format', async () => {
      const mockExport = {
        id: '1',
        projectId: 'project1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(apiClient.exports.create as jest.Mock).mockResolvedValue({
        data: { data: mockExport },
      })

      const { result } = renderHook(() => useExportStore())

      await act(async () => {
        await result.current.createExport('project1', 'json')
      })

      expect(apiClient.exports.create).toHaveBeenCalledWith('project1', 'json')
    })

    it('should handle create export error', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Failed to create export',
            },
          },
        },
      }

      ;(apiClient.exports.create as jest.Mock).mockRejectedValue(mockError)

      const { result } = renderHook(() => useExportStore())

      await act(async () => {
        try {
          await result.current.createExport('project1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.exports).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Failed to create export')
    })
  })

  describe('downloadExport', () => {
    it('should download export successfully', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' })
      ;(apiClient.exports.download as jest.Mock).mockResolvedValue({
        data: mockBlob,
      })

      // Mock document.createElement and appendChild
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      }
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation()
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation()

      const { result } = renderHook(() => useExportStore())

      await act(async () => {
        await result.current.downloadExport('export1', 'test-export.zip')
      })

      expect(apiClient.exports.download).toHaveBeenCalledWith('export1')
      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(mockLink.download).toBe('test-export.zip')
      expect(mockLink.click).toHaveBeenCalled()

      // Cleanup
      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('should handle download export error', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Failed to download export',
            },
          },
        },
      }

      ;(apiClient.exports.download as jest.Mock).mockRejectedValue(mockError)

      const { result } = renderHook(() => useExportStore())

      await act(async () => {
        try {
          await result.current.downloadExport('export1', 'test-export.zip')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe('Failed to download export')
    })
  })

  describe('getExport', () => {
    it('should get export successfully', async () => {
      const mockExport = {
        id: '1',
        projectId: 'project1',
        status: 'ready',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Set initial state with an export
      useExportStore.setState({
        exports: [{ ...mockExport, status: 'processing' }],
      })

      ;(apiClient.exports.get as jest.Mock).mockResolvedValue({
        data: { data: mockExport },
      })

      const { result } = renderHook(() => useExportStore())

      let fetchedExport
      await act(async () => {
        fetchedExport = await result.current.getExport('1')
      })

      expect(fetchedExport).toEqual(mockExport)
      expect(result.current.exports[0]).toEqual(mockExport)
      expect(apiClient.exports.get).toHaveBeenCalledWith('1')
    })

    it('should handle get export error', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Failed to fetch export',
            },
          },
        },
      }

      ;(apiClient.exports.get as jest.Mock).mockRejectedValue(mockError)

      const { result } = renderHook(() => useExportStore())

      await act(async () => {
        try {
          await result.current.getExport('1')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.error).toBe('Failed to fetch export')
    })
  })

  describe('clearError', () => {
    it('should clear error', () => {
      useExportStore.setState({ error: 'Some error' })

      const { result } = renderHook(() => useExportStore())

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useExportStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })
})

describe('Helper functions', () => {
  describe('isExportReady', () => {
    it('should return true for ready export without expiration', () => {
      const exportReq = {
        id: '1',
        status: 'ready',
      } as any

      expect(isExportReady(exportReq)).toBe(true)
    })

    it('should return true for ready export with future expiration', () => {
      const exportReq = {
        id: '1',
        status: 'ready',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
      } as any

      expect(isExportReady(exportReq)).toBe(true)
    })

    it('should return false for ready export with past expiration', () => {
      const exportReq = {
        id: '1',
        status: 'ready',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      } as any

      expect(isExportReady(exportReq)).toBe(false)
    })

    it('should return false for non-ready export', () => {
      const exportReq = {
        id: '1',
        status: 'processing',
      } as any

      expect(isExportReady(exportReq)).toBe(false)
    })
  })

  describe('getExportStatusInfo', () => {
    it('should return correct info for ready status', () => {
      const info = getExportStatusInfo('ready')
      expect(info.color).toBe('bg-green-100 text-green-800')
      expect(info.text).toBe('Ready for Download')
    })

    it('should return correct info for processing status', () => {
      const info = getExportStatusInfo('processing')
      expect(info.color).toBe('bg-yellow-100 text-yellow-800')
      expect(info.text).toBe('Processing')
    })

    it('should return correct info for pending status', () => {
      const info = getExportStatusInfo('pending')
      expect(info.color).toBe('bg-blue-100 text-blue-800')
      expect(info.text).toBe('Pending')
    })

    it('should return correct info for failed status', () => {
      const info = getExportStatusInfo('failed')
      expect(info.color).toBe('bg-red-100 text-red-800')
      expect(info.text).toBe('Failed')
    })

    it('should return default info for unknown status', () => {
      const info = getExportStatusInfo('unknown')
      expect(info.color).toBe('bg-gray-100 text-gray-800')
      expect(info.text).toBe('unknown')
    })
  })
})