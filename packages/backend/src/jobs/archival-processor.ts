import { ArchivalService } from '../services/archival-service';
import { LoggingService } from '../services/logging-service';

/**
 * Background job processor for handling archival-related tasks
 */
export class ArchivalProcessor {
  private archivalService: ArchivalService;
  private loggingService: LoggingService;

  constructor() {
    this.archivalService = new ArchivalService();
    this.loggingService = LoggingService; // LoggingService is already an instance
  }

  /**
   * Process expired projects and transition them to archival mode
   * This should be run daily via cron job
   */
  async processExpiredProjects(): Promise<void> {
    try {
      this.loggingService.info('Starting expired projects processing job');
      
      await this.archivalService.processExpiredProjects();
      
      this.loggingService.info('Completed expired projects processing job');
    } catch (error) {
      this.loggingService.error('Error in expired projects processing job', { error });
      throw error;
    }
  }

  /**
   * Send expiry warnings to projects approaching their subscription end
   * This should be run daily via cron job
   */
  async sendExpiryWarnings(): Promise<void> {
    try {
      this.loggingService.info('Starting expiry warnings job');
      
      // Send warnings for projects expiring in 7 days
      await this.archivalService.sendExpiryWarnings(7);
      
      // Send warnings for projects expiring in 1 day (final warning)
      await this.archivalService.sendExpiryWarnings(1);
      
      this.loggingService.info('Completed expiry warnings job');
    } catch (error) {
      this.loggingService.error('Error in expiry warnings job', { error });
      throw error;
    }
  }

  /**
   * Combined job that handles both expiry warnings and archival processing
   * This is the main job that should be scheduled to run daily
   */
  async runDailyArchivalTasks(): Promise<void> {
    try {
      this.loggingService.info('Starting daily archival tasks');
      
      // First, send expiry warnings
      await this.sendExpiryWarnings();
      
      // Then, process any expired projects
      await this.processExpiredProjects();
      
      this.loggingService.info('Completed daily archival tasks');
    } catch (error) {
      this.loggingService.error('Error in daily archival tasks', { error });
      throw error;
    }
  }
}

// Export a singleton instance for use in cron jobs
export const archivalProcessor = new ArchivalProcessor();