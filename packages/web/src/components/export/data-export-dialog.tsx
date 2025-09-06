'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AccessibleModal, ConfirmationDialog } from '@/components/accessibility/accessible-modal'
import { dataExportService, ExportRequest, ExportStatus } from '@/services/data-export.service'
import { subscriptionService } from '@/services/subscription.service'

interface DataExportDialogProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
}

export function DataExportDialog({ isOpen, onClose, projectId, projectName }: DataExportDialogProps) {
  const [step, setStep] = useState<'configure' | 'confirm' | 'processing' | 'complete'>('configure')
  const [exportRequest, setExportRequest] = useState<ExportRequest>({
    projectId,
    format: 'zip',
    includeAudio: true,
    includePhotos: true,
    includeTranscripts: true,
    includeInteractions: true
  })
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null)
  const [estimatedSize, setEstimatedSize] = useState<{ estimatedSizeMB: number; estimatedDuration: string } | null>(null)
  const [canExport, setCanExport] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      checkExportPermission()
      estimateExportSize()
    }
  }, [isOpen, projectId])

  useEffect(() => {
    if (step === 'processing' && exportStatus?.id) {
      const interval = setInterval(async () => {
        try {
          const status = await dataExportService.getExportStatus(exportStatus.id)
          setExportStatus(status)
          
          if (status.status === 'completed') {
            setStep('complete')
            clearInterval(interval)
          } else if (status.status === 'failed') {
            setError(status.error || 'Export failed')
            setStep('configure')
            clearInterval(interval)
          }
        } catch (error) {
          console.error('Failed to check export status:', error)
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [step, exportStatus?.id])

  const checkExportPermission = async () => {
    try {
      const canPerform = await subscriptionService.canPerformAction(projectId, 'export_data')
      setCanExport(canPerform)
    } catch (error) {
      console.error('Failed to check export permission:', error)
      setCanExport(false)
    }
  }

  const estimateExportSize = async () => {
    try {
      const estimate = await dataExportService.estimateExportSize(exportRequest)
      setEstimatedSize(estimate)
    } catch (error) {
      console.error('Failed to estimate export size:', error)
    }
  }

  const handleExportRequestChange = (updates: Partial<ExportRequest>) => {
    const newRequest = { ...exportRequest, ...updates }
    setExportRequest(newRequest)
    
    // Re-estimate size when options change
    dataExportService.estimateExportSize(newRequest).then(setEstimatedSize).catch(console.error)
  }

  const handleStartExport = async () => {
    try {
      setLoading(true)
      setError(null)

      const validation = dataExportService.validateExportRequest(exportRequest)
      if (!validation.isValid) {
        setError(validation.errors.join(', '))
        return
      }

      const result = await dataExportService.requestExport(exportRequest)
      const status = await dataExportService.getExportStatus(result.exportId)
      
      setExportStatus(status)
      setStep('processing')
    } catch (error) {
      console.error('Failed to start export:', error)
      setError('Failed to start export. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (exportStatus?.downloadUrl) {
      window.open(exportStatus.downloadUrl, '_blank')
    } else if (exportStatus?.id) {
      try {
        await dataExportService.downloadExport(exportStatus.id)
      } catch (error) {
        console.error('Failed to download export:', error)
        setError('Failed to download export. Please try again.')
      }
    }
  }

  const handleClose = () => {
    setStep('configure')
    setExportStatus(null)
    setError(null)
    onClose()
  }

  if (!canExport) {
    return (
      <AccessibleModal
        isOpen={isOpen}
        onClose={handleClose}
        title="导出不可用"
        description="您当前的订阅计划不支持数据导出功能"
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-muted-foreground mb-6">
            数据导出功能需要有效的订阅。请升级您的计划或续订以访问此功能。
          </p>
          <div className="flex justify-center space-x-3">
            <Button onClick={handleClose} variant="outline">
              关闭
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              查看订阅计划
            </Button>
          </div>
        </div>
      </AccessibleModal>
    )
  }

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="导出项目数据"
      description="导出您的完整项目归档，包括所有故事、照片和互动记录"
      className="max-w-2xl"
    >
      {step === 'configure' && (
        <div className="space-y-6">
          {/* Export Options */}
          <div>
            <h3 className="text-lg font-semibold mb-4">选择导出内容</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={exportRequest.includeAudio}
                  onChange={(e) => handleExportRequestChange({ includeAudio: e.target.checked })}
                  className="w-4 h-4 text-primary focus:ring-primary border-border rounded"
                />
                <span className="text-sm font-medium text-foreground">音频文件</span>
                <span className="text-xs text-muted-foreground">(原始录音)</span>
              </label>
              
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={exportRequest.includeTranscripts}
                  onChange={(e) => handleExportRequestChange({ includeTranscripts: e.target.checked })}
                  className="w-4 h-4 text-primary focus:ring-primary border-border rounded"
                />
                <span className="text-sm font-medium text-foreground">转录文本</span>
                <span className="text-xs text-muted-foreground">(AI生成的文字记录)</span>
              </label>
              
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={exportRequest.includePhotos}
                  onChange={(e) => handleExportRequestChange({ includePhotos: e.target.checked })}
                  className="w-4 h-4 text-primary focus:ring-primary border-border rounded"
                />
                <span className="text-sm font-medium text-foreground">照片</span>
                <span className="text-xs text-muted-foreground">(故事中的图片)</span>
              </label>
              
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={exportRequest.includeInteractions}
                  onChange={(e) => handleExportRequestChange({ includeInteractions: e.target.checked })}
                  className="w-4 h-4 text-primary focus:ring-primary border-border rounded"
                />
                <span className="text-sm font-medium text-foreground">互动记录</span>
                <span className="text-xs text-muted-foreground">(评论和后续问题)</span>
              </label>
            </div>
          </div>

          {/* Export Preview */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">导出预览</h4>
            {estimatedSize && (
              <div className="text-sm text-muted-foreground mb-3">
                <p>预计文件大小: {dataExportService.formatFileSize(estimatedSize.estimatedSizeMB * 1024 * 1024)}</p>
                <p>预计处理时间: {estimatedSize.estimatedDuration}</p>
              </div>
            )}
            <pre className="text-xs text-muted-foreground bg-background p-3 rounded border overflow-x-auto">
              {dataExportService.getExportStructurePreview(projectName)}
            </pre>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button onClick={handleClose} variant="outline">
              取消
            </Button>
            <Button
              onClick={() => setStep('confirm')}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              继续
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">确认导出</h3>
            <p className="text-muted-foreground mb-6">
              我们将为您创建 "{projectName}" 项目的完整归档文件。处理完成后，下载链接将发送到您的邮箱。
            </p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-yellow-700 mb-1">重要提醒</p>
                <ul className="text-yellow-600 space-y-1">
                  <li>• 导出过程可能需要几分钟时间</li>
                  <li>• 下载链接将在7天后过期</li>
                  <li>• 导出文件包含敏感的家庭信息，请妥善保管</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setStep('configure')} variant="outline">
              返回
            </Button>
            <Button
              onClick={handleStartExport}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? '正在处理...' : '开始导出'}
            </Button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">正在处理导出</h3>
            <p className="text-muted-foreground mb-4">
              我们正在为您准备导出文件，请稍候...
            </p>
            
            {exportStatus && (
              <div className="max-w-xs mx-auto">
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>进度</span>
                  <span>{exportStatus.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${exportStatus.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-primary/80">
              💡 处理完成后，下载链接将发送到您的邮箱。您也可以保持此窗口打开等待完成。
            </p>
          </div>

          <div className="flex justify-center">
            <Button onClick={handleClose} variant="outline">
              在后台继续处理
            </Button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">导出完成！</h3>
            <p className="text-muted-foreground mb-6">
              您的项目归档已准备就绪。点击下方按钮下载，或查看您的邮箱获取下载链接。
            </p>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-green-700">导出成功</p>
                <p className="text-green-600">文件大小: {exportStatus && dataExportService.formatFileSize(estimatedSize?.estimatedSizeMB || 0)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button onClick={handleClose} variant="outline">
              关闭
            </Button>
            <Button
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              下载文件
            </Button>
          </div>
        </div>
      )}
    </AccessibleModal>
  )
}
