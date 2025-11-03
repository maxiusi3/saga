const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'packages/web/public/locales');

const languages = ['ja', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt'];

const missingKeys = {
  'ja': {
    "general": {
      "title": "一般設定",
      "language": {
        "title": "言語",
        "description": "希望する言語を選択",
        "label": "インターフェース言語"
      },
      "timezone": {
        "title": "タイムゾーン",
        "description": "ローカルタイムゾーンを設定",
        "label": "タイムゾーン"
      },
      "dateFormat": {
        "title": "日付形式",
        "description": "日付の表示方法を選択",
        "label": "日付形式"
      }
    },
    "accessibility": {
      "title": "アクセシビリティ設定",
      "fontSize": {
        "title": "フォントサイズ",
        "small": "小",
        "standard": "標準",
        "large": "大",
        "extraLarge": "特大"
      },
      "highContrast": {
        "title": "高コントラスト",
        "description": "視認性向上のためコントラストを増加"
      },
      "reducedMotion": {
        "title": "モーション削減",
        "description": "アニメーションと遷移を最小化"
      },
      "screenReader": {
        "title": "スクリーンリーダーサポート",
        "description": "スクリーンリーダーに最適化"
      }
    }
  },
  'zh-CN': {
    "general": {
      "title": "常规设置",
      "language": {
        "title": "语言",
        "description": "选择首选语言",
        "label": "界面语言"
      },
      "timezone": {
        "title": "时区",
        "description": "设置本地时区",
        "label": "时区"
      },
      "dateFormat": {
        "title": "日期格式",
        "description": "选择日期显示方式",
        "label": "日期格式"
      }
    },
    "accessibility": {
      "title": "辅助功能设置",
      "fontSize": {
        "title": "字体大小",
        "small": "小",
        "standard": "标准",
        "large": "大",
        "extraLarge": "特大"
      },
      "highContrast": {
        "title": "高对比度",
        "description": "增加对比度以提高可见性"
      },
      "reducedMotion": {
        "title": "减少动画",
        "description": "最小化动画和过渡效果"
      },
      "screenReader": {
        "title": "屏幕阅读器支持",
        "description": "针对屏幕阅读器优化"
      }
    }
  },
  'zh-TW': {
    "general": {
      "title": "一般設定",
      "language": {
        "title": "語言",
        "description": "選擇偏好語言",
        "label": "介面語言"
      },
      "timezone": {
        "title": "時區",
        "description": "設定本地時區",
        "label": "時區"
      },
      "dateFormat": {
        "title": "日期格式",
        "description": "選擇日期顯示方式",
        "label": "日期格式"
      }
    },
    "accessibility": {
      "title": "輔助功能設定",
      "fontSize": {
        "title": "字型大小",
        "small": "小",
        "standard": "標準",
        "large": "大",
        "extraLarge": "特大"
      },
      "highContrast": {
        "title": "高對比度",
        "description": "增加對比度以提高可見性"
      },
      "reducedMotion": {
        "title": "減少動畫",
        "description": "最小化動畫和過渡效果"
      },
      "screenReader": {
        "title": "螢幕閱讀器支援",
        "description": "針對螢幕閱讀器最佳化"
      }
    }
  },
  'fr': {
    "general": {
      "title": "Paramètres généraux",
      "language": {
        "title": "Langue",
        "description": "Sélectionner la langue préférée",
        "label": "Langue de l'interface"
      },
      "timezone": {
        "title": "Fuseau horaire",
        "description": "Définir le fuseau horaire local",
        "label": "Fuseau horaire"
      },
      "dateFormat": {
        "title": "Format de date",
        "description": "Choisir le mode d'affichage des dates",
        "label": "Format de date"
      }
    },
    "accessibility": {
      "title": "Paramètres d'accessibilité",
      "fontSize": {
        "title": "Taille de police",
        "small": "Petit",
        "standard": "Standard",
        "large": "Grand",
        "extraLarge": "Très grand"
      },
      "highContrast": {
        "title": "Contraste élevé",
        "description": "Augmenter le contraste pour améliorer la visibilité"
      },
      "reducedMotion": {
        "title": "Mouvement réduit",
        "description": "Minimiser les animations et transitions"
      },
      "screenReader": {
        "title": "Support lecteur d'écran",
        "description": "Optimisé pour les lecteurs d'écran"
      }
    }
  },
  'es': {
    "general": {
      "title": "Configuración general",
      "language": {
        "title": "Idioma",
        "description": "Seleccionar idioma preferido",
        "label": "Idioma de la interfaz"
      },
      "timezone": {
        "title": "Zona horaria",
        "description": "Establecer zona horaria local",
        "label": "Zona horaria"
      },
      "dateFormat": {
        "title": "Formato de fecha",
        "description": "Elegir modo de visualización de fechas",
        "label": "Formato de fecha"
      }
    },
    "accessibility": {
      "title": "Configuración de accesibilidad",
      "fontSize": {
        "title": "Tamaño de fuente",
        "small": "Pequeño",
        "standard": "Estándar",
        "large": "Grande",
        "extraLarge": "Muy grande"
      },
      "highContrast": {
        "title": "Alto contraste",
        "description": "Aumentar contraste para mejorar visibilidad"
      },
      "reducedMotion": {
        "title": "Movimiento reducido",
        "description": "Minimizar animaciones y transiciones"
      },
      "screenReader": {
        "title": "Soporte lector de pantalla",
        "description": "Optimizado para lectores de pantalla"
      }
    }
  },
  'pt': {
    "general": {
      "title": "Configurações gerais",
      "language": {
        "title": "Idioma",
        "description": "Selecionar idioma preferido",
        "label": "Idioma da interface"
      },
      "timezone": {
        "title": "Fuso horário",
        "description": "Definir fuso horário local",
        "label": "Fuso horário"
      },
      "dateFormat": {
        "title": "Formato de data",
        "description": "Escolher modo de exibição de datas",
        "label": "Formato de data"
      }
    },
    "accessibility": {
      "title": "Configurações de acessibilidade",
      "fontSize": {
        "title": "Tamanho da fonte",
        "small": "Pequeno",
        "standard": "Padrão",
        "large": "Grande",
        "extraLarge": "Muito grande"
      },
      "highContrast": {
        "title": "Alto contraste",
        "description": "Aumentar contraste para melhorar visibilidade"
      },
      "reducedMotion": {
        "title": "Movimento reduzido",
        "description": "Minimizar animações e transições"
      },
      "screenReader": {
        "title": "Suporte leitor de tela",
        "description": "Otimizado para leitores de tela"
      }
    }
  }
};

languages.forEach(lang => {
  const filePath = path.join(localesDir, lang, 'settings.json');
  
  try {
    let data = {};
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    
    // Add missing keys
    if (missingKeys[lang]) {
      data = { ...data, ...missingKeys[lang] };
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Updated ${lang}/settings.json`);
  } catch (error) {
    console.error(`❌ Error updating ${lang}/settings.json:`, error.message);
  }
});

console.log('\n✅ All settings translations fixed!');
