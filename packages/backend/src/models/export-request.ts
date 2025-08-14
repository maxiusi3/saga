import { BaseModel } from './base'
import { ExportRequest, CreateExportRequestInput, UpdateExportRequestInput } from '@saga/shared'

export class ExportRequestModel extends BaseModel {
  protected static tableName = 'export_requests'

  static async createExportRequest(exportData: CreateExportRequestInput): Promise<ExportRequest> {
    return this.create({
      project_id: exportData.projectId,
      facilitator_id: exportData.facilitatorId,
      status: 'pending',
    })
  }

  static async updateExportRequest(id: string, exportData: UpdateExportRequestInput): Promise<ExportRequest> {
    const updateData: any = {}
    
    if (exportData.status !== undefined) updateData.status = exportData.status
    if (exportData.downloadUrl !== undefined) updateData.download_url = exportData.downloadUrl
    if (exportData.expiresAt !== undefined) updateData.expires_at = exportData.expiresAt

    return this.update(id, updateData)
  }

  static async findByProject(projectId: string): Promise<ExportRequest[]> {
    return this.query()
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')
  }

  static async findByFacilitator(facilitatorId: string): Promise<ExportRequest[]> {
    return this.query()
      .where('facilitator_id', facilitatorId)
      .orderBy('created_at', 'desc')
  }

  static async getActiveExports(): Promise<ExportRequest[]> {
    return this.query()
      .whereIn('status', ['pending', 'processing'])
      .orderBy('created_at', 'asc')
  }

  static async getExpiredExports(): Promise<ExportRequest[]> {
    return this.query()
      .where('status', 'ready')
      .where('expires_at', '<', new Date())
  }

  static async cleanupExpiredExports(): Promise<number> {
    const expiredExports = await this.getExpiredExports()
    
    if (expiredExports.length === 0) return 0

    // Update status to expired
    await this.query()
      .whereIn('id', expiredExports.map(e => e.id))
      .update({ status: 'expired' })

    return expiredExports.length
  }

  static async getExportStats(projectId?: string) {
    let query = this.query()
    
    if (projectId) {
      query = query.where('project_id', projectId)
    }

    const stats = await query
      .select(
        this.db.raw('COUNT(*) as total_exports'),
        this.db.raw('COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_exports'),
        this.db.raw('COUNT(CASE WHEN status = \'processing\' THEN 1 END) as processing_exports'),
        this.db.raw('COUNT(CASE WHEN status = \'ready\' THEN 1 END) as ready_exports'),
        this.db.raw('COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failed_exports'),
        this.db.raw('COUNT(CASE WHEN status = \'expired\' THEN 1 END) as expired_exports')
      )
      .first()

    return {
      totalExports: parseInt(stats?.total_exports) || 0,
      pendingExports: parseInt(stats?.pending_exports) || 0,
      processingExports: parseInt(stats?.processing_exports) || 0,
      readyExports: parseInt(stats?.ready_exports) || 0,
      failedExports: parseInt(stats?.failed_exports) || 0,
      expiredExports: parseInt(stats?.expired_exports) || 0,
    }
  }
}