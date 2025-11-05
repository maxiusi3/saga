const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'packages/web/public/locales');

const itemTranslations = {
  'ja': {
    "in": "で",
    "markAsRead": "既読にする",
    "delete": "通知を削除"
  },
  'zh-CN': {
    "in": "在",
    "markAsRead": "标记为已读",
    "delete": "删除通知"
  },
  'zh-TW': {
    "in": "在",
    "markAsRead": "標記為已讀",
    "delete": "刪除通知"
  },
  'fr': {
    "in": "dans",
    "markAsRead": "Marquer comme lu",
    "delete": "Supprimer la notification"
  },
  'es': {
    "in": "en",
    "markAsRead": "Marcar como leído",
    "delete": "Eliminar notificación"
  },
  'pt': {
    "in": "em",
    "markAsRead": "Marcar como lido",
    "delete": "Excluir notificação"
  }
};

Object.keys(itemTranslations).forEach(lang => {
  const filePath = path.join(localesDir, lang, 'notifications-page.json');
  
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      data.item = itemTranslations[lang];
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ Updated ${lang}/notifications-page.json`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${lang}/notifications-page.json:`, error.message);
  }
});

console.log('\n✅ All notifications translations updated!');
