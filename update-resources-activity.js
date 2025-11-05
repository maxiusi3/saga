const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'packages/web/public/locales');

const activityTranslations = {
  'ko': {
    "created": "\"{name}\" 생성됨",
    "usedProject": "프로젝트 바우처 1개 사용",
    "invitedStoryteller": "{name}을(를) 이야기꾼으로 초대함",
    "usedStoryteller": "이야기꾼 좌석 1개 사용",
    "invitedFacilitator": "{name}을(를) 진행자로 초대함",
    "usedFacilitator": "진행자 좌석 1개 사용"
  },
  'ja': {
    "created": "\"{name}\"を作成",
    "usedProject": "プロジェクトバウチャー1個使用",
    "invitedStoryteller": "{name}をストーリーテラーとして招待",
    "usedStoryteller": "ストーリーテラー席1個使用",
    "invitedFacilitator": "{name}をファシリテーターとして招待",
    "usedFacilitator": "ファシリテーター席1個使用"
  },
  'zh-CN': {
    "created": "创建了\"{name}\"",
    "usedProject": "使用了1个项目代金券",
    "invitedStoryteller": "邀请{name}作为讲述者",
    "usedStoryteller": "使用了1个讲述者席位",
    "invitedFacilitator": "邀请{name}作为协调员",
    "usedFacilitator": "使用了1个协调员席位"
  },
  'zh-TW': {
    "created": "建立了\"{name}\"",
    "usedProject": "使用了1個專案代金券",
    "invitedStoryteller": "邀請{name}作為講述者",
    "usedStoryteller": "使用了1個講述者席位",
    "invitedFacilitator": "邀請{name}作為協調員",
    "usedFacilitator": "使用了1個協調員席位"
  },
  'fr': {
    "created": "Créé \"{name}\"",
    "usedProject": "Utilisé 1 bon de projet",
    "invitedStoryteller": "Invité {name} en tant que conteur",
    "usedStoryteller": "Utilisé 1 place de conteur",
    "invitedFacilitator": "Invité {name} en tant que facilitateur",
    "usedFacilitator": "Utilisé 1 place de facilitateur"
  },
  'es': {
    "created": "Creado \"{name}\"",
    "usedProject": "Usado 1 vale de proyecto",
    "invitedStoryteller": "Invitado {name} como narrador",
    "usedStoryteller": "Usado 1 asiento de narrador",
    "invitedFacilitator": "Invitado {name} como facilitador",
    "usedFacilitator": "Usado 1 asiento de facilitador"
  },
  'pt': {
    "created": "Criado \"{name}\"",
    "usedProject": "Usado 1 voucher de projeto",
    "invitedStoryteller": "Convidado {name} como contador",
    "usedStoryteller": "Usado 1 assento de contador",
    "invitedFacilitator": "Convidado {name} como facilitador",
    "usedFacilitator": "Usado 1 assento de facilitador"
  }
};

Object.keys(activityTranslations).forEach(lang => {
  const filePath = path.join(localesDir, lang, 'resources.json');
  
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      data.activity = activityTranslations[lang];
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ Updated ${lang}/resources.json`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${lang}/resources.json:`, error.message);
  }
});

console.log('\n✅ All resources activity translations updated!');
