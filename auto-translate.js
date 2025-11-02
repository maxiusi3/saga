const fs = require('fs');
const path = require('path');

const untranslated = JSON.parse(fs.readFileSync('untranslated-items.json', 'utf8'));
const baseDir = 'packages/web/public/locales';

const languageNames = {
  'es': 'Spanish',
  'fr': 'French',
  'ja': 'Japanese',
  'ko': 'Korean',
  'pt': 'Portuguese',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese'
};

// Helper function to set nested value
function setValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

// Generate translation prompts for each file/language combination
const translationTasks = [];

for (const [file, langs] of Object.entries(untranslated)) {
  for (const [lang, items] of Object.entries(langs)) {
    if (items.length > 0) {
      // Filter out emojis, prices, names, and technical terms that shouldn't be translated
      const itemsToTranslate = items.filter(item => {
        const key = item.key;
        const value = item.value;
        
        // Skip emojis
        if (key.includes('.emoji') || /^[\p{Emoji}]+$/u.test(value)) {
          return false;
        }
        
        // Skip prices
        if (key.includes('.price') || /^\$\d+$/.test(value)) {
          return false;
        }
        
        // Skip names (but not titles)
        if (key.includes('.name') && !key.includes('brandName') && !key.includes('.name"')) {
          const hasCapitalWords = /^[A-Z][a-z]+ [A-Z][a-z]+/.test(value);
          if (hasCapitalWords) return false;
        }
        
        // Skip technical terms
        if (value === 'CVV' || value === 'CVC' || value === 'Error' || value === 'Pause' || value === 'Email') {
          return false;
        }
        
        return true;
      });
      
      if (itemsToTranslate.length > 0) {
        translationTasks.push({
          file,
          lang,
          items: itemsToTranslate
        });
      }
    }
  }
}

console.log(`Found ${translationTasks.length} translation tasks`);
console.log('\nTranslation tasks by file:');

const tasksByFile = {};
translationTasks.forEach(task => {
  if (!tasksByFile[task.file]) {
    tasksByFile[task.file] = [];
  }
  tasksByFile[task.file].push(`${task.lang} (${task.items.length} items)`);
});

for (const [file, tasks] of Object.entries(tasksByFile)) {
  console.log(`\n${file}:`);
  tasks.forEach(t => console.log(`  - ${t}`));
}

// Save translation tasks for manual processing
fs.writeFileSync('translation-tasks.json', JSON.stringify(translationTasks, null, 2));
console.log('\n\nTranslation tasks saved to translation-tasks.json');
console.log('\nTo translate, you can use the OpenAI API or manual translation.');
console.log('The script will generate the translations and update the files.');
