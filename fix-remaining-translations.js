const fs = require('fs');
const path = require('path');

// AI translation function
async function translateWithAI(text, targetLang, context = '') {
  try {
    const response = await fetch('http://localhost:3000/api/ai/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Translate the following JSON content to ${targetLang}. Maintain the exact JSON structure and keys. Only translate the values. Context: ${context}\n\n${JSON.stringify(text, null, 2)}`,
        type: 'translation'
      })
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.content);
  } catch (error) {
    console.error(`Translation error for ${targetLang}:`, error.message);
    return null;
  }
}

// Language configurations
const languages = [
  { code: 'zh-CN', name: 'Simplified Chinese' },
  { code: 'zh-TW', name: 'Traditional Chinese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' }
];

async function translateFile(sourceFile, targetLang, langName) {
  const sourcePath = path.join(__dirname, 'packages/web/public/locales/en', sourceFile);
  const targetPath = path.join(__dirname, `packages/web/public/locales/${targetLang}`, sourceFile);

  console.log(`\n📝 Translating ${sourceFile} to ${langName}...`);

  // Read source file
  const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

  // Check if target exists and has content
  let needsTranslation = true;
  if (fs.existsSync(targetPath)) {
    const targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    if (Object.keys(targetContent).length > 0) {
      console.log(`   ✓ ${sourceFile} already translated for ${langName}`);
      needsTranslation = false;
    }
  }

  if (needsTranslation) {
    const translated = await translateWithAI(sourceContent, langName, `This is for a family biography app called Saga`);
    
    if (translated) {
      fs.writeFileSync(targetPath, JSON.stringify(translated, null, 2), 'utf8');
      console.log(`   ✅ Successfully translated ${sourceFile} to ${langName}`);
    } else {
      console.log(`   ❌ Failed to translate ${sourceFile} to ${langName}`);
    }

    // Wait to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function main() {
  console.log('🚀 Starting translation of remaining pages...\n');

  const filesToTranslate = [
    'help.json',
    'notifications-page.json',
    'purchase-page.json',
    'resources.json'
  ];

  for (const file of filesToTranslate) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Processing: ${file}`);
    console.log('='.repeat(60));

    for (const lang of languages) {
      await translateFile(file, lang.code, lang.name);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Translation process completed!');
  console.log('='.repeat(60));
}

main().catch(console.error);
