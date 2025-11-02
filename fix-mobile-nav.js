const fs = require('fs');
const path = require('path');

const translations = {
  'fr': { mySagas: "Mes Sagas", resources: "Ressources" },
  'ja': { mySagas: "マイサガ", resources: "リソース" },
  'ko': { mySagas: "내 사가", resources: "리소스" },
  'pt': { mySagas: "Minhas Sagas", resources: "Recursos" },
  'zh-CN': { mySagas: "我的传奇", resources: "资源" },
  'zh-TW': { mySagas: "我的傳奇", resources: "資源" }
};

const baseDir = 'packages/web/public/locales';

for (const [lang, trans] of Object.entries(translations)) {
  const filePath = path.join(baseDir, lang, 'common.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  content.mobileNav = {
    mySagas: trans.mySagas,
    resources: trans.resources
  };
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`✓ Updated ${lang}/common.json`);
}

console.log('\nAll mobile navigation translations added!');
