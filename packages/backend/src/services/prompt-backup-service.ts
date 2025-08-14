import { BaseModel } from '../models/base';
import { Prompt } from '../models/prompt';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  text: string;
  category: string;
  difficulty: string;
  tags: string[];
  followUpQuestions: string[];
  audioUrl?: string;
  changeReason?: string;
  changedBy?: string;
  createdAt: Date;
}

interface PromptBackup {
  id: string;
  backupType: 'manual' | 'scheduled' | 'pre_update';
  promptCount: number;
  filePath: string;
  fileSize: number;
  checksum: string;
  createdBy?: string;
  createdAt: Date;
}

interface BackupRestoreOptions {
  backupId: string;
  promptIds?: string[]; // If specified, only restore these prompts
  overwriteExisting?: boolean;
  createVersions?: boolean;
}

class PromptBackupServiceClass {
  private db = BaseModel.db;
  private backupDirectory = process.env.PROMPT_BACKUP_DIR || './backups/prompts';

  /**
   * Create a version when a prompt is updated
   */
  async createPromptVersion(
    promptId: string,
    changeReason?: string,
    changedBy?: string
  ): Promise<PromptVersion> {
    try {
      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        throw new Error('Prompt not found');
      }

      // Get the next version number
      const latestVersion = await this.db('prompt_versions')
        .where('prompt_id', promptId)
        .orderBy('version', 'desc')
        .first();

      const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

      const versionData = {
        prompt_id: promptId,
        version: nextVersion,
        text: prompt.data.text,
        category: prompt.data.category,
        difficulty: prompt.data.difficulty,
        tags: JSON.stringify(prompt.getTags()),
        follow_up_questions: JSON.stringify(prompt.getFollowUpQuestions()),
        audio_url: prompt.data.audioUrl,
        change_reason: changeReason,
        changed_by: changedBy,
        created_at: new Date(),
      };

      const [created] = await this.db('prompt_versions')
        .insert(versionData)
        .returning('*');

      return this.transformDbToPromptVersion(created);
    } catch (error) {
      console.error('Failed to create prompt version:', error);
      throw error;
    }
  }

  /**
   * Get version history for a prompt
   */
  async getPromptVersionHistory(promptId: string): Promise<PromptVersion[]> {
    try {
      const versions = await this.db('prompt_versions')
        .where('prompt_id', promptId)
        .orderBy('version', 'desc');

      return versions.map(this.transformDbToPromptVersion);
    } catch (error) {
      console.error('Failed to get prompt version history:', error);
      return [];
    }
  }

  /**
   * Get a specific version of a prompt
   */
  async getPromptVersion(promptId: string, version: number): Promise<PromptVersion | null> {
    try {
      const versionData = await this.db('prompt_versions')
        .where('prompt_id', promptId)
        .where('version', version)
        .first();

      return versionData ? this.transformDbToPromptVersion(versionData) : null;
    } catch (error) {
      console.error('Failed to get prompt version:', error);
      return null;
    }
  }

  /**
   * Revert prompt to a previous version
   */
  async revertPromptToVersion(
    promptId: string,
    version: number,
    revertedBy?: string
  ): Promise<boolean> {
    try {
      const targetVersion = await this.getPromptVersion(promptId, version);
      if (!targetVersion) {
        throw new Error(`Version ${version} not found for prompt ${promptId}`);
      }

      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        throw new Error('Prompt not found');
      }

      // Create a version of the current state before reverting
      await this.createPromptVersion(
        promptId,
        `Reverted to version ${version}`,
        revertedBy
      );

      // Update the prompt with the target version data
      await prompt.update({
        text: targetVersion.text,
        category: targetVersion.category as any,
        difficulty: targetVersion.difficulty as any,
        tags: targetVersion.tags,
        followUpQuestions: targetVersion.followUpQuestions,
        audioUrl: targetVersion.audioUrl,
      });

      return true;
    } catch (error) {
      console.error('Failed to revert prompt to version:', error);
      return false;
    }
  }

  /**
   * Create a backup of all prompts
   */
  async createBackup(
    backupType: 'manual' | 'scheduled' | 'pre_update' = 'manual',
    createdBy?: string
  ): Promise<PromptBackup> {
    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();

      // Get all library prompts
      const prompts = await Prompt.findLibraryPrompts();
      
      // Create backup data
      const backupData = {
        metadata: {
          backupType,
          createdBy,
          createdAt: new Date().toISOString(),
          promptCount: prompts.length,
          version: '1.0',
        },
        prompts: prompts.map(prompt => ({
          id: prompt.data.id,
          text: prompt.data.text,
          category: prompt.data.category,
          difficulty: prompt.data.difficulty,
          tags: prompt.getTags(),
          followUpQuestions: prompt.getFollowUpQuestions(),
          audioUrl: prompt.data.audioUrl,
          isLibraryPrompt: prompt.data.isLibraryPrompt,
          templateId: prompt.data.templateId,
          createdAt: prompt.data.createdAt,
          updatedAt: prompt.data.updatedAt,
        })),
      };

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `prompt-backup-${timestamp}.json`;
      const filePath = path.join(this.backupDirectory, filename);

      // Write backup file
      const backupJson = JSON.stringify(backupData, null, 2);
      await fs.writeFile(filePath, backupJson, 'utf8');

      // Calculate file size and checksum
      const stats = await fs.stat(filePath);
      const checksum = await this.calculateChecksum(backupJson);

      // Store backup metadata in database
      const backupMetadata = {
        backup_type: backupType,
        prompt_count: prompts.length,
        file_path: filePath,
        file_size: stats.size,
        checksum,
        created_by: createdBy,
        created_at: new Date(),
      };

      const [created] = await this.db('prompt_backups')
        .insert(backupMetadata)
        .returning('*');

      return this.transformDbToPromptBackup(created);
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Get all backups
   */
  async getBackups(): Promise<PromptBackup[]> {
    try {
      const backups = await this.db('prompt_backups')
        .orderBy('created_at', 'desc');

      return backups.map(this.transformDbToPromptBackup);
    } catch (error) {
      console.error('Failed to get backups:', error);
      return [];
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: BackupRestoreOptions): Promise<{
    success: boolean;
    restoredCount: number;
    errors: string[];
  }> {
    try {
      // Get backup metadata
      const backup = await this.db('prompt_backups')
        .where('id', options.backupId)
        .first();

      if (!backup) {
        throw new Error('Backup not found');
      }

      // Read backup file
      const backupContent = await fs.readFile(backup.file_path, 'utf8');
      const backupData = JSON.parse(backupContent);

      // Verify checksum
      const calculatedChecksum = await this.calculateChecksum(backupContent);
      if (calculatedChecksum !== backup.checksum) {
        throw new Error('Backup file integrity check failed');
      }

      let restoredCount = 0;
      const errors: string[] = [];

      // Filter prompts to restore
      let promptsToRestore = backupData.prompts;
      if (options.promptIds && options.promptIds.length > 0) {
        promptsToRestore = promptsToRestore.filter((p: any) => 
          options.promptIds!.includes(p.id)
        );
      }

      // Restore each prompt
      for (const promptData of promptsToRestore) {
        try {
          const existingPrompt = await Prompt.findById(promptData.id);

          if (existingPrompt && !options.overwriteExisting) {
            errors.push(`Prompt ${promptData.id} already exists and overwrite is disabled`);
            continue;
          }

          if (existingPrompt && options.createVersions) {
            // Create version before overwriting
            await this.createPromptVersion(
              promptData.id,
              `Restored from backup ${options.backupId}`,
              'system'
            );
          }

          if (existingPrompt) {
            // Update existing prompt
            await existingPrompt.update({
              text: promptData.text,
              category: promptData.category,
              difficulty: promptData.difficulty,
              tags: promptData.tags,
              followUpQuestions: promptData.followUpQuestions,
              audioUrl: promptData.audioUrl,
            });
          } else {
            // Create new prompt
            await Prompt.create({
              text: promptData.text,
              category: promptData.category,
              difficulty: promptData.difficulty,
              tags: promptData.tags,
              followUpQuestions: promptData.followUpQuestions,
              audioUrl: promptData.audioUrl,
              isLibraryPrompt: promptData.isLibraryPrompt,
              templateId: promptData.templateId,
            });
          }

          restoredCount++;
        } catch (error) {
          errors.push(`Failed to restore prompt ${promptData.id}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        restoredCount,
        errors,
      };
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return {
        success: false,
        restoredCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Delete old backups (cleanup)
   */
  async cleanupOldBackups(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Get old backups
      const oldBackups = await this.db('prompt_backups')
        .where('created_at', '<', cutoffDate)
        .where('backup_type', '!=', 'manual'); // Keep manual backups

      let deletedCount = 0;

      for (const backup of oldBackups) {
        try {
          // Delete file
          await fs.unlink(backup.file_path);
          
          // Delete database record
          await this.db('prompt_backups')
            .where('id', backup.id)
            .delete();

          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete backup ${backup.id}:`, error);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
      return 0;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStatistics(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    backupsByType: Record<string, number>;
  }> {
    try {
      const backups = await this.db('prompt_backups');

      const totalBackups = backups.length;
      const totalSize = backups.reduce((sum, backup) => sum + backup.file_size, 0);

      const dates = backups.map(b => new Date(b.created_at)).sort();
      const oldestBackup = dates.length > 0 ? dates[0] : undefined;
      const newestBackup = dates.length > 0 ? dates[dates.length - 1] : undefined;

      const backupsByType: Record<string, number> = {};
      backups.forEach(backup => {
        backupsByType[backup.backup_type] = (backupsByType[backup.backup_type] || 0) + 1;
      });

      return {
        totalBackups,
        totalSize,
        oldestBackup,
        newestBackup,
        backupsByType,
      };
    } catch (error) {
      console.error('Failed to get backup statistics:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        backupsByType: {},
      };
    }
  }

  /**
   * Helper methods
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create backup directory:', error);
      throw error;
    }
  }

  private async calculateChecksum(content: string): Promise<string> {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private transformDbToPromptVersion(row: any): PromptVersion {
    return {
      id: row.id,
      promptId: row.prompt_id,
      version: row.version,
      text: row.text,
      category: row.category,
      difficulty: row.difficulty,
      tags: row.tags ? JSON.parse(row.tags) : [],
      followUpQuestions: row.follow_up_questions ? JSON.parse(row.follow_up_questions) : [],
      audioUrl: row.audio_url,
      changeReason: row.change_reason,
      changedBy: row.changed_by,
      createdAt: new Date(row.created_at),
    };
  }

  private transformDbToPromptBackup(row: any): PromptBackup {
    return {
      id: row.id,
      backupType: row.backup_type,
      promptCount: row.prompt_count,
      filePath: row.file_path,
      fileSize: row.file_size,
      checksum: row.checksum,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
    };
  }
}

export const PromptBackupService = new PromptBackupServiceClass();