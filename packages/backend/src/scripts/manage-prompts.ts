#!/usr/bin/env ts-node

import { Command } from 'commander';
import { AIPromptService } from '../services/ai-prompt-service';
import { Prompt } from '../models/prompt';
import { connectDatabase } from '../config/database';

const program = new Command();

program
  .name('manage-prompts')
  .description('CLI tool for managing AI prompts')
  .version('1.0.0');

program
  .command('list')
  .description('List all prompts in the library')
  .option('-c, --category <category>', 'Filter by category')
  .option('-d, --difficulty <difficulty>', 'Filter by difficulty')
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .action(async (options) => {
    try {
      await connectDatabase();
      
      const prompts = await Prompt.findLibraryPrompts({
        category: options.category,
        difficulty: options.difficulty,
        limit: parseInt(options.limit),
      });

      console.log(`\n📚 Found ${prompts.length} prompts:\n`);
      
      prompts.forEach((prompt, index) => {
        console.log(`${index + 1}. [${prompt.data.category.toUpperCase()}] [${prompt.data.difficulty.toUpperCase()}]`);
        console.log(`   ${prompt.data.text}`);
        console.log(`   Tags: ${prompt.getTags().join(', ')}`);
        console.log(`   Follow-ups: ${prompt.getFollowUpQuestions().length}`);
        console.log('');
      });
    } catch (error) {
      console.error('Error listing prompts:', error);
      process.exit(1);
    }
  });

program
  .command('add')
  .description('Add a new prompt to the library')
  .requiredOption('-t, --text <text>', 'Prompt text')
  .requiredOption('-c, --category <category>', 'Category (childhood, family, career, relationships, general)')
  .requiredOption('-d, --difficulty <difficulty>', 'Difficulty (easy, medium, hard)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--follow-ups <questions>', 'Comma-separated follow-up questions')
  .action(async (options) => {
    try {
      await connectDatabase();
      
      const validCategories = ['childhood', 'family', 'career', 'relationships', 'general'];
      const validDifficulties = ['easy', 'medium', 'hard'];
      
      if (!validCategories.includes(options.category)) {
        console.error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
        process.exit(1);
      }
      
      if (!validDifficulties.includes(options.difficulty)) {
        console.error(`Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}`);
        process.exit(1);
      }

      const prompt = await Prompt.create({
        text: options.text,
        category: options.category,
        difficulty: options.difficulty,
        tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
        followUpQuestions: options.followUps ? options.followUps.split(',').map((q: string) => q.trim()) : [],
        isLibraryPrompt: true,
      });

      console.log(`\n✅ Added new prompt:`);
      console.log(`   ID: ${prompt.data.id}`);
      console.log(`   Category: ${prompt.data.category}`);
      console.log(`   Difficulty: ${prompt.data.difficulty}`);
      console.log(`   Text: ${prompt.data.text}`);
      console.log('');
    } catch (error) {
      console.error('Error adding prompt:', error);
      process.exit(1);
    }
  });

program
  .command('test-generation')
  .description('Test AI prompt generation')
  .requiredOption('-u, --user <userId>', 'User ID for testing')
  .option('-c, --category <category>', 'Category to generate for')
  .action(async (options) => {
    try {
      await connectDatabase();
      
      console.log(`\n🤖 Testing AI prompt generation for user: ${options.user}\n`);
      
      const request = {
        userId: options.user,
        category: options.category,
        previousPrompts: [],
        userPreferences: {
          topics: ['family', 'memories'],
          avoidTopics: ['illness', 'death'],
        },
      };

      const prompt = await AIPromptService.generatePersonalizedPrompt(request);
      
      console.log(`Generated Prompt:`);
      console.log(`  Text: ${prompt.text}`);
      console.log(`  Category: ${prompt.category}`);
      console.log(`  Difficulty: ${prompt.difficulty}`);
      console.log(`  Tags: ${prompt.tags?.join(', ') || 'None'}`);
      console.log(`  Follow-ups: ${prompt.followUpQuestions?.length || 0}`);
      
      if (prompt.followUpQuestions && prompt.followUpQuestions.length > 0) {
        console.log(`\n  Follow-up Questions:`);
        prompt.followUpQuestions.forEach((q, i) => {
          console.log(`    ${i + 1}. ${q}`);
        });
      }
      console.log('');
    } catch (error) {
      console.error('Error testing generation:', error);
      process.exit(1);
    }
  });

program
  .command('test-follow-ups')
  .description('Test follow-up question generation')
  .requiredOption('-s, --story <content>', 'Story content')
  .requiredOption('-p, --prompt <prompt>', 'Original prompt')
  .action(async (options) => {
    try {
      await connectDatabase();
      
      console.log(`\n🤖 Testing follow-up question generation\n`);
      console.log(`Original Prompt: ${options.prompt}`);
      console.log(`Story Content: ${options.story}\n`);
      
      const questions = await AIPromptService.generateFollowUpQuestions(
        options.story,
        options.prompt
      );
      
      console.log(`Generated ${questions.length} follow-up questions:`);
      questions.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q}`);
      });
      console.log('');
    } catch (error) {
      console.error('Error testing follow-up generation:', error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show prompt library statistics')
  .action(async () => {
    try {
      await connectDatabase();
      
      const allPrompts = await Prompt.findLibraryPrompts();
      
      const stats = {
        total: allPrompts.length,
        byCategory: {} as Record<string, number>,
        byDifficulty: {} as Record<string, number>,
        withAudio: 0,
        withFollowUps: 0,
      };
      
      allPrompts.forEach(prompt => {
        // Count by category
        stats.byCategory[prompt.data.category] = (stats.byCategory[prompt.data.category] || 0) + 1;
        
        // Count by difficulty
        stats.byDifficulty[prompt.data.difficulty] = (stats.byDifficulty[prompt.data.difficulty] || 0) + 1;
        
        // Count with audio
        if (prompt.hasAudio()) {
          stats.withAudio++;
        }
        
        // Count with follow-ups
        if (prompt.getFollowUpQuestions().length > 0) {
          stats.withFollowUps++;
        }
      });
      
      console.log(`\n📊 Prompt Library Statistics:\n`);
      console.log(`Total Prompts: ${stats.total}`);
      console.log(`\nBy Category:`);
      Object.entries(stats.byCategory).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
      console.log(`\nBy Difficulty:`);
      Object.entries(stats.byDifficulty).forEach(([difficulty, count]) => {
        console.log(`  ${difficulty}: ${count}`);
      });
      console.log(`\nWith Audio: ${stats.withAudio}`);
      console.log(`With Follow-ups: ${stats.withFollowUps}`);
      console.log('');
    } catch (error) {
      console.error('Error getting stats:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate all prompts in the library')
  .action(async () => {
    try {
      await connectDatabase();
      
      const prompts = await Prompt.findLibraryPrompts();
      const issues: string[] = [];
      
      console.log(`\n🔍 Validating ${prompts.length} prompts...\n`);
      
      prompts.forEach((prompt, index) => {
        const data = prompt.data;
        
        // Check text length
        if (data.text.length < 10) {
          issues.push(`Prompt ${index + 1}: Text too short (${data.text.length} chars)`);
        }
        if (data.text.length > 200) {
          issues.push(`Prompt ${index + 1}: Text too long (${data.text.length} chars)`);
        }
        
        // Check for question mark
        if (!data.text.includes('?')) {
          issues.push(`Prompt ${index + 1}: Missing question mark`);
        }
        
        // Check follow-up questions
        const followUps = prompt.getFollowUpQuestions();
        if (followUps.length === 0) {
          issues.push(`Prompt ${index + 1}: No follow-up questions`);
        } else if (followUps.length > 5) {
          issues.push(`Prompt ${index + 1}: Too many follow-up questions (${followUps.length})`);
        }
        
        // Check tags
        const tags = prompt.getTags();
        if (tags.length === 0) {
          issues.push(`Prompt ${index + 1}: No tags`);
        }
      });
      
      if (issues.length === 0) {
        console.log(`✅ All prompts are valid!`);
      } else {
        console.log(`❌ Found ${issues.length} issues:`);
        issues.forEach(issue => {
          console.log(`  - ${issue}`);
        });
      }
      console.log('');
    } catch (error) {
      console.error('Error validating prompts:', error);
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
  process.exit(1);
});

if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);