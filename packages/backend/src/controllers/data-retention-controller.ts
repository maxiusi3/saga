import { Request, Response } from 'express';
import { DataRetentionService } from '../services/data-retention-service';
import { LoggingService } from '../services/logging-service';

/**
 * Controller for data retention policy management
 */
export class DataRetentionController {
  /**
   * Get all retention policies
   */
  static async getRetentionPolicies(req: Request, res: Response): Promise<void> {
    try {
      const retentionService = new DataRetentionService();
      const policies = retentionService.getRetentionPolicies();
      
      res.json({
        success: true,
        data: policies,
      });
    } catch (error) {
      LoggingService.error('Error getting retention policies', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to get retention policies',
      });
    }
  }

  /**
   * Get a specific retention policy
   */
  static async getRetentionPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { policyName } = req.params;
      const retentionService = new DataRetentionService();
      const policy = retentionService.getRetentionPolicy(policyName);
      
      if (!policy) {
        res.status(404).json({
          success: false,
          error: 'Retention policy not found',
        });
        return;
      }

      res.json({
        success: true,
        data: policy,
      });
    } catch (error) {
      LoggingService.error('Error getting retention policy', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to get retention policy',
      });
    }
  }

  /**
   * Execute all retention policies
   */
  static async executeAllPolicies(req: Request, res: Response): Promise<void> {
    try {
      const retentionService = new DataRetentionService();
      const reports = await retentionService.executeAllPolicies();
      
      res.json({
        success: true,
        data: {
          reports,
          summary: {
            totalPoliciesExecuted: reports.length,
            totalItemsDeleted: reports.reduce((sum, report) => sum + report.itemsDeleted, 0),
            totalStorageFreed: reports.reduce((sum, report) => sum + report.storageFreed, 0),
            totalErrors: reports.reduce((sum, report) => sum + report.errors.length, 0),
          },
        },
      });
    } catch (error) {
      LoggingService.error('Error executing retention policies', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to execute retention policies',
      });
    }
  }

  /**
   * Execute a specific retention policy
   */
  static async executePolicy(req: Request, res: Response): Promise<void> {
    try {
      const { policyName } = req.params;
      const retentionService = new DataRetentionService();
      const policy = retentionService.getRetentionPolicy(policyName);
      
      if (!policy) {
        res.status(404).json({
          success: false,
          error: 'Retention policy not found',
        });
        return;
      }

      const report = await retentionService.executePolicy(policy);
      
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      LoggingService.error('Error executing retention policy', { 
        policyName: req.params.policyName,
        error: error as Error 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to execute retention policy',
      });
    }
  }

  /**
   * Get retention status and next execution times
   */
  static async getRetentionStatus(req: Request, res: Response): Promise<void> {
    try {
      const retentionService = new DataRetentionService();
      const status = retentionService.getRetentionStatus();
      
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      LoggingService.error('Error getting retention status', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to get retention status',
      });
    }
  }

  /**
   * Validate a retention policy configuration
   */
  static async validatePolicy(req: Request, res: Response): Promise<void> {
    try {
      const policy = req.body;
      const retentionService = new DataRetentionService();
      const validation = retentionService.validatePolicy(policy);
      
      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      LoggingService.error('Error validating retention policy', { error: error as Error });
      res.status(500).json({
        success: false,
        error: 'Failed to validate retention policy',
      });
    }
  }

  /**
   * Get retention policy preview (what would be deleted)
   */
  static async getPolicyPreview(req: Request, res: Response): Promise<void> {
    try {
      const { policyName } = req.params;
      const { dryRun } = req.query;
      
      if (dryRun !== 'true') {
        res.status(400).json({
          success: false,
          error: 'Preview requires dryRun=true parameter',
        });
        return;
      }

      const retentionService = new DataRetentionService();
      const policy = retentionService.getRetentionPolicy(policyName);
      
      if (!policy) {
        res.status(404).json({
          success: false,
          error: 'Retention policy not found',
        });
        return;
      }

      // For preview, we would implement a dry-run version of executePolicy
      // that returns what would be deleted without actually deleting it
      res.json({
        success: true,
        data: {
          policy,
          preview: {
            message: 'Preview functionality would show what items would be deleted',
            estimatedItemsToDelete: 0,
            estimatedStorageToFree: 0,
          },
        },
      });
    } catch (error) {
      LoggingService.error('Error getting policy preview', { 
        policyName: req.params.policyName,
        error: error as Error 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get policy preview',
      });
    }
  }
}