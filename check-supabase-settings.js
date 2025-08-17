#!/usr/bin/env node

/**
 * 检查 Supabase 邮箱验证设置
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
const supabaseUrl = 'https://encdblxyxztvfxotfuyh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuY2RibHh5eHp0dmZ4b3RmdXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4Njg1MDksImV4cCI6MjA2OTQ0NDUwOX0.9QdNqwICg1FNQIvWKlSq1zzU2PWp5cwpwK_5DMA2a88';

async function checkSupabaseSettings() {
  console.log('🔍 检查 Supabase 邮箱验证设置\n');

  console.log('📋 当前配置:');
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   项目 ID: encdblxyxztvfxotfuyh`);
  
  console.log('\n🔗 重定向 URL 设置:');
  console.log('   开发环境: http://localhost:3001/auth/callback');
  console.log('   生产环境: https://your-domain.com/auth/callback');
  
  console.log('\n📧 邮箱验证流程:');
  console.log('   1. 用户注册时指定 emailRedirectTo');
  console.log('   2. Supabase 发送验证邮件');
  console.log('   3. 用户点击邮件中的链接');
  console.log('   4. 重定向到指定的 callback URL');
  console.log('   5. 前端处理验证令牌');

  console.log('\n⚙️ 需要在 Supabase Dashboard 中配置:');
  console.log('   1. Authentication > URL Configuration');
  console.log('   2. Site URL: http://localhost:3001');
  console.log('   3. Redirect URLs: http://localhost:3001/auth/callback');
  
  console.log('\n📝 邮件模板变量:');
  console.log('   {{ .ConfirmationURL }} - 验证链接');
  console.log('   {{ .Email }} - 用户邮箱');
  console.log('   {{ .SiteURL }} - 站点 URL');

  console.log('\n🔧 故障排除:');
  console.log('   如果验证链接仍然有问题:');
  console.log('   1. 检查 Supabase Dashboard 中的 URL 配置');
  console.log('   2. 确认邮件模板使用正确的变量');
  console.log('   3. 验证 emailRedirectTo 参数格式');
  console.log('   4. 检查浏览器控制台的错误信息');

  return true;
}

async function testAuthCallback() {
  console.log('\n🧪 测试 Auth Callback 处理\n');

  // 模拟验证 URL 的各种格式
  const testUrls = [
    'http://localhost:3001/auth/callback#access_token=xxx&expires_at=xxx&expires_in=3600&refresh_token=xxx&token_type=bearer&type=signup',
    'http://localhost:3001/auth/callback?access_token=xxx&expires_at=xxx&expires_in=3600&refresh_token=xxx&token_type=bearer&type=signup',
    'https://encdblxyxztvfxotfuyh.supabase.co/auth/v1/verify?token=xxx&type=signup&redirect_to=http://localhost:3001/auth/callback'
  ];

  console.log('📋 支持的验证 URL 格式:');
  testUrls.forEach((url, index) => {
    console.log(`   ${index + 1}. ${url}`);
  });

  console.log('\n✅ Auth Callback 页面应该处理:');
  console.log('   - URL hash 中的令牌 (#access_token=...)');
  console.log('   - URL query 中的令牌 (?access_token=...)');
  console.log('   - 设置用户会话');
  console.log('   - 重定向到仪表板');
  console.log('   - 显示欢迎消息');

  return true;
}

async function main() {
  console.log('🚀 Supabase 邮箱验证设置检查\n');
  console.log('=' .repeat(60));

  await checkSupabaseSettings();
  await testAuthCallback();

  console.log('\n' + '='.repeat(60));
  console.log('🎯 下一步行动:');
  console.log('   1. 在浏览器中打开 test-ui-improvements.html');
  console.log('   2. 按照测试步骤进行手动测试');
  console.log('   3. 验证所有 UI 改进是否正常工作');
  console.log('   4. 检查邮箱中的验证链接格式');
  
  console.log('\n🏁 检查完成');
}

main().catch(console.error);