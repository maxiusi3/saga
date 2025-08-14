import cron from 'node-cron';
import { archivalProcessor } from '../jobs/archival-processor';
import { LoggingService } from './logging-service';
import { DataRetentionService } from './data-retention-service';

/**
 * Service for managing scheduled background jobs
 */
export class SchedulerService {
  private loggingService: LoggingService;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.loggingService = LoggingService; // LoggingService is already an instance
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    this.loggingService.info('Starting scheduler service');

    // Daily archival tasks - run at 2 AM UTC every day
    const archivalJob = cron.schedule('0 2 * * *', async () => {
      try {
        await archivalProcessor.runDailyArchivalTasks();
      } catch (error) {
        this.loggingService.error('Error in scheduled archival task', { error });
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('archival-daily', archivalJob);
    archivalJob.start();

    // Weekly data retention job - run at 3 AM UTC every Sunday
    const retentionJob = cron.schedule('0 3 * * 0', async () => {
      try {
        this.loggingService.info('Running weekly data retention policies');
        const retentionService = new DataRetentionService();
        const reports = await retentionService.executeAllPolicies();
        
        const summary = {
          totalPoliciesExecuted: reports.length,
          totalItemsDeleted: reports.reduce((sum, report) => sum + report.itemsDeleted, 0),
          totalStorageFreed: reports.reduce((sum, report) => sum + report.storageFreed, 0),
          totalErrors: reports.reduce((sum, report) => sum + report.errors.length, 0),
        };
        
        this.loggingService.info('Completed weekly data retention policies', summary);
      } catch (error) {
        this.loggingService.error('Error in scheduled data retention task', { error });
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('retention-weekly', retentionJob);
    retentionJob.start();

    this.loggingService.info('All scheduled jobs started');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.loggingService.info('Stopping scheduler service');

    for (const [name, job] of this.jobs) {
      job.stop();
      this.loggingService.info(`Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.loggingService.info('All scheduled jobs stopped');
  }

  /**
   * Get status of all jobs
   */
  getJobStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    
    for (const [name, job] of this.jobs) {
      status[name] = job.running;
    }

    return status;
  }

  /**
   * Manually trigger a specific job (useful for testing)
   */
  async triggerJob(jobName: string): Promise<void> {
    switch (jobName) {
      case 'archival-daily':
        await archivalProcessor.runDailyArchivalTasks();
        break;
      case 'expiry-warnings':
        await archivalProcessor.sendExpiryWarnings();
        break;
      case 'process-expired':
        await archivalProcessor.processExpiredProjects();
        break;
      case 'data-retention':
        const retentionService = new DataRetentionService();
        await retentionService.executeAllPolicies();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();