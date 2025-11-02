const fs = require('fs');
const path = require('path');

const languages = ['es', 'fr', 'ja', 'ko', 'pt', 'zh-CN', 'zh-TW'];
const baseDir = 'packages/web/public/locales';

// Get all English translation files
const enDir = path.join(baseDir, 'en');
const enFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.json'));

const report = {
  summary: {},
  details: {}
};

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getValue(obj, keyPath) {
  const keys = keyPath.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

for (const file of enFiles) {
  const enPath = path.join(enDir, file);
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const allKeys = getAllKeys(enContent);
  
  report.details[file] = {};
  
  for (const lang of languages) {
    const targetPath = path.join(baseDir, lang, file);
    
    if (!fs.existsSync(targetPath)) {
      report.details[file][lang] = {
        status: 'MISSING_FILE',
        missing: allKeys.length,
        untranslated: 0,
        total: allKeys.length
      };
      continue;
    }
    
    const targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    
    let missing = 0;
    let untranslated = 0;
    const missingKeys = [];
    const untranslatedKeys = [];
    
    for (const key of allKeys) {
      const enValue = getValue(enContent, key);
      const targetValue = getValue(targetContent, key);
      
      if (targetValue === undefined) {
        missing++;
        missingKeys.push(key);
      } else if (typeof enValue === 'string' && enValue === targetValue && enValue.length > 0) {
        // Skip AI prompts and technical strings
        if (!key.includes('systemPrompt') && !key.includes('userPromptTemplate') && !key.includes('contextPrefix')) {
          untranslated++;
          untranslatedKeys.push({ key, value: enValue });
        }
      }
    }
    
    report.details[file][lang] = {
      status: missing === 0 && untranslated === 0 ? 'COMPLETE' : 'INCOMPLETE',
      missing,
      untranslated,
      total: allKeys.length,
      missingKeys,
      untranslatedKeys
    };
    
    if (!report.summary[lang]) {
      report.summary[lang] = { complete: 0, incomplete: 0, missing: 0 };
    }
    
    if (missing === 0 && untranslated === 0) {
      report.summary[lang].complete++;
    } else {
      report.summary[lang].incomplete++;
    }
  }
}

// Print summary
console.log('=== TRANSLATION SUMMARY ===\n');
for (const lang of languages) {
  const stats = report.summary[lang];
  const total = stats.complete + stats.incomplete;
  const percentage = ((stats.complete / total) * 100).toFixed(1);
  console.log(`${lang}: ${stats.complete}/${total} files complete (${percentage}%)`);
}

// Print detailed issues
console.log('\n=== INCOMPLETE TRANSLATIONS ===\n');
for (const file of enFiles) {
  let hasIssues = false;
  const fileIssues = [];
  
  for (const lang of languages) {
    const details = report.details[file][lang];
    if (details.status !== 'COMPLETE') {
      hasIssues = true;
      fileIssues.push(`  ${lang}: ${details.missing} missing, ${details.untranslated} untranslated`);
    }
  }
  
  if (hasIssues) {
    console.log(`${file}:`);
    fileIssues.forEach(issue => console.log(issue));
    console.log('');
  }
}

// Save detailed report
fs.writeFileSync('translation-report.json', JSON.stringify(report, null, 2));
console.log('Detailed report saved to translation-report.json');
