const fs = require('fs');

const report = JSON.parse(fs.readFileSync('translation-report.json', 'utf8'));

const toTranslate = {};

for (const [file, langs] of Object.entries(report.details)) {
  for (const [lang, details] of Object.entries(langs)) {
    if (details.untranslatedKeys && details.untranslatedKeys.length > 0) {
      if (!toTranslate[file]) toTranslate[file] = {};
      if (!toTranslate[file][lang]) toTranslate[file][lang] = [];
      
      details.untranslatedKeys.forEach(item => {
        toTranslate[file][lang].push(item);
      });
    }
  }
}

// Group by file and show what needs translation
for (const [file, langs] of Object.entries(toTranslate)) {
  console.log(`\n=== ${file} ===`);
  for (const [lang, items] of Object.entries(langs)) {
    console.log(`\n${lang} (${items.length} items):`);
    items.slice(0, 5).forEach(item => {
      console.log(`  ${item.key}: "${item.value.substring(0, 60)}${item.value.length > 60 ? '...' : ''}"`);
    });
    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more`);
    }
  }
}

fs.writeFileSync('untranslated-items.json', JSON.stringify(toTranslate, null, 2));
console.log('\n\nFull list saved to untranslated-items.json');
