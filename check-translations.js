const fs = require('fs');
const path = require('path');

const languages = ['es', 'fr', 'ja', 'ko', 'pt', 'zh-CN', 'zh-TW'];
const baseDir = 'packages/web/public/locales';

// Get all English translation files
const enDir = path.join(baseDir, 'en');
const enFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.json'));

const issues = [];

function checkTranslations(enObj, targetObj, lang, file, prefix = '') {
  const problems = [];
  
  for (const key in enObj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof enObj[key] === 'object' && !Array.isArray(enObj[key])) {
      if (!targetObj[key] || typeof targetObj[key] !== 'object') {
        problems.push(`Missing object: ${fullKey}`);
      } else {
        problems.push(...checkTranslations(enObj[key], targetObj[key], lang, file, fullKey));
      }
    } else {
      if (!targetObj.hasOwnProperty(key)) {
        problems.push(`Missing key: ${fullKey}`);
      } else if (targetObj[key] === enObj[key] && typeof enObj[key] === 'string' && enObj[key].length > 0) {
        // Check if translation is same as English (might be untranslated)
        problems.push(`Possibly untranslated: ${fullKey} = "${enObj[key]}"`);
      }
    }
  }
  
  return problems;
}

for (const file of enFiles) {
  const enPath = path.join(enDir, file);
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  
  for (const lang of languages) {
    const targetPath = path.join(baseDir, lang, file);
    
    if (!fs.existsSync(targetPath)) {
      issues.push(`${lang}/${file}: FILE MISSING`);
      continue;
    }
    
    const targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const problems = checkTranslations(enContent, targetContent, lang, file);
    
    if (problems.length > 0) {
      issues.push(`\n${lang}/${file}:`);
      problems.forEach(p => issues.push(`  - ${p}`));
    }
  }
}

if (issues.length > 0) {
  console.log('Translation Issues Found:\n');
  console.log(issues.join('\n'));
} else {
  console.log('All translations are complete!');
}
