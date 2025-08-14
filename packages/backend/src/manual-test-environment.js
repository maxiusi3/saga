/**
 * AI Prompt Service 人工测试环境
 * 这个脚本提供了一个交互式环境来测试AI Prompt Service的各种功能
 */

const readline = require('readline');

// 模拟改进的AI Prompt Service
class TestAIPromptService {
  constructor() {
    this.promptLibrary = [
      {
        id: 'childhood-001',
        text: '告诉我你童年时最喜欢的地方是哪里？',
        category: 'childhood',
        difficulty: 'easy',
        tags: ['童年', '地方', '回忆']
      },
      {
        id: 'family-001', 
        text: '描述一个你们家庭的传统或习俗。',
        category: 'family',
        difficulty: 'easy',
        tags: ['家庭', '传统', '文化']
      },
      {
        id: 'career-001',
        text: '回忆一下你第一份工作的经历。',
        category: 'career', 
        difficulty: 'medium',
        tags: ['工作', '经历', '成长']
      },
      {
        id: 'general-001',
        text: '分享一个让你印象深刻的人生转折点。',
        category: 'general',
        difficulty: 'hard',
        tags: ['人生', '转折', '成长']
      }
    ];
    
    this.cache = new Map();
    this.performanceMetrics = new Map();
    this.rateLimitTracker = new Map();
  }

  // 生成个性化提示
  async generatePersonalizedPrompt(request) {
    const startTime = Date.now();
    
    try {
      // 输入验证
      if (!request.userId || request.userId.trim().length === 0) {
        throw new Error('用户ID是必需的');
      }

      // 检查缓存
      const cacheKey = this.generateCacheKey(request);
      if (this.cache.has(cacheKey)) {
        console.log('✅ 从缓存返回结果');
        return this.cache.get(cacheKey);
      }

      // 检查速率限制
      if (this.isRateLimited(request.userId)) {
        console.log('⚠️ 触发速率限制，返回回退提示');
        return this.getFallbackPrompt(request);
      }

      // 模拟AI生成（实际环境中会调用OpenAI）
      console.log('🤖 正在生成个性化提示...');
      await this.delay(1000); // 模拟API调用延迟

      const prompt = {
        id: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: this.generateContextualPrompt(request),
        category: request.category || 'general',
        difficulty: this.determineDifficulty(request),
        tags: this.generateTags(request),
        personalizedFor: request.userId,
        createdAt: new Date(),
        source: 'ai-generated'
      };

      // 缓存结果
      this.cache.set(cacheKey, prompt);
      
      const duration = Date.now() - startTime;
      this.recordPerformance('generatePersonalizedPrompt', duration);
      
      console.log(`✅ 生成完成，耗时: ${duration}ms`);
      return prompt;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ 生成失败: ${error.message}`);
      this.recordPerformance('generatePersonalizedPrompt_error', duration);
      
      const fallback = this.getFallbackPrompt(request);
      fallback.tags = [...(fallback.tags || []), 'fallback', 'error'];
      return fallback;
    }
  }

  // 生成跟进问题
  async generateFollowUpQuestions(storyContent, originalPrompt) {
    try {
      if (!storyContent || storyContent.trim().length < 10) {
        console.log('⚠️ 故事内容太短，无法生成跟进问题');
        return [];
      }

      console.log('🤖 正在生成跟进问题...');
      await this.delay(800);

      // 基于故事内容生成相关问题
      const questions = this.generateContextualQuestions(storyContent);
      
      console.log(`✅ 生成了 ${questions.length} 个跟进问题`);
      return questions;

    } catch (error) {
      console.error(`❌ 生成跟进问题失败: ${error.message}`);
      return [];
    }
  }

  // 获取下一个提示
  async getNextPrompt(projectId, userId) {
    try {
      console.log(`🔍 为项目 ${projectId} 获取下一个提示...`);
      
      // 检查速率限制
      if (this.isRateLimited(userId)) {
        console.log('⚠️ 触发速率限制');
        return this.getFallbackPrompt({ userId, category: 'general' });
      }

      // 模拟从数据库获取项目状态
      await this.delay(200);
      
      // 随机选择一个提示
      const availablePrompts = this.promptLibrary.filter(p => Math.random() > 0.3);
      if (availablePrompts.length === 0) {
        return this.getFallbackPrompt({ userId, category: 'general' });
      }

      const selectedPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
      
      console.log(`✅ 返回 ${selectedPrompt.category} 类别的提示`);
      return {
        ...selectedPrompt,
        personalizedFor: userId,
        createdAt: new Date(),
        source: 'library'
      };

    } catch (error) {
      console.error(`❌ 获取提示失败: ${error.message}`);
      return this.getFallbackPrompt({ userId, category: 'general' });
    }
  }

  // 获取性能指标
  getPerformanceMetrics() {
    const metrics = {};
    this.performanceMetrics.forEach((value, key) => {
      metrics[key] = Math.round(value);
    });
    return metrics;
  }

  // 清除缓存
  async clearCaches() {
    this.cache.clear();
    this.rateLimitTracker.clear();
    this.performanceMetrics.clear();
    console.log('🧹 缓存已清除');
  }

  // 辅助方法
  generateCacheKey(request) {
    const timeWindow = Math.floor(Date.now() / 300000); // 5分钟窗口
    const key = [
      request.userId,
      request.category || 'general',
      timeWindow,
      JSON.stringify(request.userPreferences || {})
    ].join('|');
    
    return `prompt_${Buffer.from(key).toString('base64').slice(0, 16)}`;
  }

  isRateLimited(userId) {
    const now = Date.now();
    const userRequests = this.rateLimitTracker.get(userId) || 0;
    
    if (userRequests > 5) { // 测试环境限制更低
      return true;
    }
    
    this.rateLimitTracker.set(userId, userRequests + 1);
    
    // 30秒后重置（测试环境更短）
    setTimeout(() => {
      this.rateLimitTracker.delete(userId);
    }, 30000);
    
    return false;
  }

  recordPerformance(operation, duration) {
    const existing = this.performanceMetrics.get(operation) || 0;
    this.performanceMetrics.set(operation, (existing + duration) / 2);
    
    if (duration > 1000) {
      console.log(`⚠️ 慢操作检测: ${operation} 耗时 ${duration}ms`);
    }
  }

  generateContextualPrompt(request) {
    const prompts = {
      childhood: [
        '回忆一下你小时候最喜欢的游戏或玩具，它给你带来了什么快乐？',
        '描述一下你童年时期的家，哪个房间或角落对你最特别？',
        '告诉我一个你小时候和朋友们一起做过的有趣的事情。'
      ],
      family: [
        '分享一个你们家庭独有的传统或习俗，它是如何开始的？',
        '描述一次难忘的家庭聚会或节日庆祝。',
        '告诉我一个家庭成员给你的重要建议或教导。'
      ],
      career: [
        '回忆你职业生涯中最有成就感的一个时刻。',
        '描述一次工作中遇到的挑战以及你是如何克服的。',
        '分享一个对你职业发展有重要影响的人或经历。'
      ],
      general: [
        '告诉我一个改变了你人生观的经历。',
        '分享一个你至今仍然珍藏的回忆。',
        '描述一次让你感到特别自豪的时刻。'
      ]
    };

    const categoryPrompts = prompts[request.category] || prompts.general;
    return categoryPrompts[Math.floor(Math.random() * categoryPrompts.length)];
  }

  generateContextualQuestions(storyContent) {
    const questions = [];
    const content = storyContent.toLowerCase();

    if (content.includes('家') || content.includes('家庭')) {
      questions.push('还有其他家庭成员参与这个故事吗？');
      questions.push('这个经历对你的家庭关系有什么影响？');
    }

    if (content.includes('朋友') || content.includes('同学')) {
      questions.push('你现在还和这些朋友保持联系吗？');
      questions.push('这段友谊教会了你什么？');
    }

    if (content.includes('工作') || content.includes('职业')) {
      questions.push('这个经历如何影响了你后来的职业选择？');
      questions.push('你会给年轻人什么建议？');
    }

    // 通用问题
    if (questions.length < 2) {
      questions.push('当时你的感受是什么？');
      questions.push('这个经历对你有什么长远的影响？');
      questions.push('如果重新来过，你会做什么不同的选择吗？');
    }

    return questions.slice(0, 3);
  }

  determineDifficulty(request) {
    if (request.category === 'childhood') return 'easy';
    if (request.category === 'family') return 'easy';
    if (request.category === 'career') return 'medium';
    return 'hard';
  }

  generateTags(request) {
    const baseTags = ['个性化', '生成'];
    if (request.category) baseTags.push(request.category);
    if (request.userPreferences?.topics) {
      baseTags.push(...request.userPreferences.topics.slice(0, 2));
    }
    return baseTags;
  }

  getFallbackPrompt(request) {
    const fallbackPrompts = this.promptLibrary.filter(p => 
      !request.category || p.category === request.category
    );
    
    const selected = fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)] || this.promptLibrary[0];
    
    return {
      ...selected,
      personalizedFor: request.userId,
      createdAt: new Date(),
      source: 'fallback'
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 测试环境主程序
class TestEnvironment {
  constructor() {
    this.service = new TestAIPromptService();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.currentUser = 'test-user-001';
    this.currentProject = 'test-project-001';
  }

  async start() {
    console.log('\n🎯 AI Prompt Service 人工测试环境');
    console.log('=====================================');
    console.log('当前用户:', this.currentUser);
    console.log('当前项目:', this.currentProject);
    console.log('');
    
    await this.showMenu();
  }

  async showMenu() {
    console.log('\n📋 可用测试功能:');
    console.log('1. 生成个性化提示');
    console.log('2. 生成跟进问题');
    console.log('3. 获取下一个提示');
    console.log('4. 查看性能指标');
    console.log('5. 清除缓存');
    console.log('6. 速率限制测试');
    console.log('7. 错误处理测试');
    console.log('8. 更改用户ID');
    console.log('0. 退出');
    console.log('');

    const choice = await this.askQuestion('请选择功能 (0-8): ');
    await this.handleChoice(choice.trim());
  }

  async handleChoice(choice) {
    try {
      switch (choice) {
        case '1':
          await this.testGeneratePersonalizedPrompt();
          break;
        case '2':
          await this.testGenerateFollowUpQuestions();
          break;
        case '3':
          await this.testGetNextPrompt();
          break;
        case '4':
          await this.showPerformanceMetrics();
          break;
        case '5':
          await this.service.clearCaches();
          break;
        case '6':
          await this.testRateLimit();
          break;
        case '7':
          await this.testErrorHandling();
          break;
        case '8':
          await this.changeUserId();
          break;
        case '0':
          console.log('👋 测试结束，再见！');
          this.rl.close();
          return;
        default:
          console.log('❌ 无效选择，请重试');
      }
    } catch (error) {
      console.error('❌ 执行出错:', error.message);
    }

    await this.showMenu();
  }

  async testGeneratePersonalizedPrompt() {
    console.log('\n🤖 测试个性化提示生成');
    console.log('========================');
    
    const category = await this.askQuestion('请选择类别 (childhood/family/career/general) [general]: ');
    const topics = await this.askQuestion('请输入感兴趣的话题 (用逗号分隔) [可选]: ');
    
    const request = {
      userId: this.currentUser,
      category: category.trim() || 'general',
      userPreferences: {
        topics: topics.trim() ? topics.split(',').map(t => t.trim()) : []
      }
    };

    console.log('\n📤 发送请求:', JSON.stringify(request, null, 2));
    
    const result = await this.service.generatePersonalizedPrompt(request);
    
    console.log('\n📥 返回结果:');
    console.log('ID:', result.id);
    console.log('文本:', result.text);
    console.log('类别:', result.category);
    console.log('难度:', result.difficulty);
    console.log('标签:', result.tags.join(', '));
    console.log('来源:', result.source);
    console.log('创建时间:', result.createdAt.toLocaleString());
  }

  async testGenerateFollowUpQuestions() {
    console.log('\n❓ 测试跟进问题生成');
    console.log('===================');
    
    const storyContent = await this.askQuestion('请输入故事内容: ');
    const originalPrompt = await this.askQuestion('请输入原始提示 [可选]: ');
    
    console.log('\n🤖 生成跟进问题...');
    
    const questions = await this.service.generateFollowUpQuestions(
      storyContent.trim(),
      originalPrompt.trim() || undefined
    );
    
    console.log('\n📥 生成的跟进问题:');
    if (questions.length === 0) {
      console.log('❌ 没有生成任何问题');
    } else {
      questions.forEach((question, index) => {
        console.log(`${index + 1}. ${question}`);
      });
    }
  }

  async testGetNextPrompt() {
    console.log('\n⏭️ 测试获取下一个提示');
    console.log('=====================');
    
    console.log('🔍 获取下一个提示...');
    
    const result = await this.service.getNextPrompt(this.currentProject, this.currentUser);
    
    console.log('\n📥 返回结果:');
    console.log('ID:', result.id);
    console.log('文本:', result.text);
    console.log('类别:', result.category);
    console.log('难度:', result.difficulty);
    console.log('标签:', result.tags.join(', '));
    console.log('来源:', result.source);
  }

  async showPerformanceMetrics() {
    console.log('\n📊 性能指标');
    console.log('============');
    
    const metrics = this.service.getPerformanceMetrics();
    
    if (Object.keys(metrics).length === 0) {
      console.log('📈 暂无性能数据');
    } else {
      Object.entries(metrics).forEach(([operation, avgTime]) => {
        console.log(`${operation}: ${avgTime}ms (平均)`);
      });
    }
  }

  async testRateLimit() {
    console.log('\n🚦 测试速率限制');
    console.log('================');
    
    console.log('🔄 快速发送多个请求...');
    
    const requests = Array(8).fill(null).map((_, i) => ({
      userId: this.currentUser,
      category: 'general',
      requestNumber: i + 1
    }));

    for (const request of requests) {
      console.log(`\n📤 请求 ${request.requestNumber}:`);
      const result = await this.service.generatePersonalizedPrompt(request);
      console.log(`📥 ${result.source === 'fallback' ? '回退提示' : '正常提示'}: ${result.text.substring(0, 50)}...`);
      
      // 短暂延迟以观察效果
      await this.service.delay(100);
    }
  }

  async testErrorHandling() {
    console.log('\n🚨 测试错误处理');
    console.log('================');
    
    console.log('1. 测试空用户ID...');
    try {
      await this.service.generatePersonalizedPrompt({ userId: '' });
    } catch (error) {
      console.log('✅ 正确捕获错误:', error.message);
    }
    
    console.log('\n2. 测试短故事内容...');
    const questions = await this.service.generateFollowUpQuestions('短');
    console.log('✅ 返回空数组:', questions.length === 0);
    
    console.log('\n3. 测试无效项目ID...');
    const result = await this.service.getNextPrompt('invalid-project', this.currentUser);
    console.log('✅ 返回回退提示:', result.source === 'fallback');
  }

  async changeUserId() {
    console.log('\n👤 更改用户ID');
    console.log('==============');
    
    const newUserId = await this.askQuestion(`当前用户ID: ${this.currentUser}\n请输入新的用户ID: `);
    
    if (newUserId.trim()) {
      this.currentUser = newUserId.trim();
      console.log('✅ 用户ID已更新为:', this.currentUser);
    } else {
      console.log('❌ 用户ID不能为空');
    }
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }
}

// 启动测试环境
if (require.main === module) {
  const testEnv = new TestEnvironment();
  testEnv.start().catch(console.error);
}

module.exports = { TestAIPromptService, TestEnvironment };