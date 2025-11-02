const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

const resourcesTranslations = {
  'ja': {
    "title": "マイリソース",
    "subtitle": "利用可能な席を管理し、追加リソースを購入",
    "buyMoreSeats": "席を追加購入",
    "available": "利用可能",
    "usage": "使用状況",
    "usageStats": "{total}席中{used}席使用",
    "buyMore": "追加購入（${price}各）",
    "recentActivity": "最近のアクティビティ",
    "purchaseAdditional": "追加席を購入",
    "packagePromo": "複数の席が必要ですか？完全パッケージでより良い価値を得られます。",
    "viewPackage": "Sagaパッケージを見る（$29）",
    "types": {
      "project": {
        "title": "プロジェクトバウチャー",
        "description": "新しい家族の物語プロジェクトを作成"
      },
      "facilitator": {
        "title": "ファシリテーター席",
        "description": "プロジェクト管理を手伝うファシリテーターを招待"
      },
      "storyteller": {
        "title": "ストーリーテラー席",
        "description": "物語を共有する家族メンバーを招待"
      }
    },
    "purchase": {
      "project": {
        "title": "プロジェクトバウチャー",
        "description": "追加の家族物語プロジェクトを1つ作成"
      },
      "facilitator": {
        "title": "ファシリテーター席",
        "description": "プロジェクト管理を手伝うファシリテーターを1人招待"
      },
      "storyteller": {
        "title": "ストーリーテラー席",
        "description": "プロジェクトに追加のストーリーテラーを1人招待"
      },
      "button": "購入"
    },
    "alerts": {
      "purchaseComingSoon": "{type}席の購入機能は近日公開予定"
    }
  },
  'ko': {
    "title": "내 리소스",
    "subtitle": "사용 가능한 좌석을 관리하고 추가 리소스를 구매하세요",
    "buyMoreSeats": "더 많은 좌석 구매",
    "available": "사용 가능",
    "usage": "사용량",
    "usageStats": "{total}개 중 {used}개 사용",
    "buyMore": "더 구매 (각 ${price})",
    "recentActivity": "최근 활동",
    "purchaseAdditional": "추가 좌석 구매",
    "packagePromo": "여러 좌석이 필요하신가요? 완전한 패키지로 더 나은 가치를 얻으세요.",
    "viewPackage": "사가 패키지 보기 ($29)",
    "types": {
      "project": {
        "title": "프로젝트 바우처",
        "description": "새로운 가족 이야기 프로젝트 생성"
      },
      "facilitator": {
        "title": "진행자 좌석",
        "description": "프로젝트 관리를 도울 진행자 초대"
      },
      "storyteller": {
        "title": "이야기꾼 좌석",
        "description": "이야기를 공유할 가족 구성원 초대"
      }
    },
    "purchase": {
      "project": {
        "title": "프로젝트 바우처",
        "description": "추가 가족 이야기 프로젝트 하나 생성"
      },
      "facilitator": {
        "title": "진행자 좌석",
        "description": "프로젝트 관리를 도울 진행자 한 명 초대"
      },
      "storyteller": {
        "title": "이야기꾼 좌석",
        "description": "프로젝트에 추가 이야기꾼 한 명 초대"
      },
      "button": "구매"
    },
    "alerts": {
      "purchaseComingSoon": "{type} 좌석 구매 기능이 곧 출시됩니다"
    }
  },
  'pt': {
    "title": "Meus Recursos",
    "subtitle": "Gerencie seus assentos disponíveis e compre recursos adicionais",
    "buyMoreSeats": "Comprar Mais Assentos",
    "available": "Disponível",
    "usage": "Uso",
    "usageStats": "{used} de {total} usados",
    "buyMore": "Comprar Mais (${price} cada)",
    "recentActivity": "Atividade Recente",
    "purchaseAdditional": "Comprar Assentos Adicionais",
    "packagePromo": "Precisa de vários assentos? Obtenha melhor valor com nosso pacote completo.",
    "viewPackage": "Ver Pacote Saga ($29)",
    "types": {
      "project": {
        "title": "Vouchers de Projeto",
        "description": "Criar novos projetos de histórias familiares"
      },
      "facilitator": {
        "title": "Assentos de Facilitador",
        "description": "Convidar facilitadores para ajudar a gerenciar projetos"
      },
      "storyteller": {
        "title": "Assentos de Contador de Histórias",
        "description": "Convidar membros da família para compartilhar suas histórias"
      }
    },
    "purchase": {
      "project": {
        "title": "Voucher de Projeto",
        "description": "Criar um projeto adicional de história familiar"
      },
      "facilitator": {
        "title": "Assento de Facilitador",
        "description": "Convidar um facilitador para ajudar a gerenciar projetos"
      },
      "storyteller": {
        "title": "Assento de Contador de Histórias",
        "description": "Convidar um contador de histórias adicional aos seus projetos"
      },
      "button": "Comprar"
    },
    "alerts": {
      "purchaseComingSoon": "A funcionalidade de compra de assento {type} estará disponível em breve"
    }
  },
  'zh-CN': {
    "title": "我的资源",
    "subtitle": "管理您的可用席位并购买额外资源",
    "buyMoreSeats": "购买更多席位",
    "available": "可用",
    "usage": "使用情况",
    "usageStats": "已使用 {used}/{total}",
    "buyMore": "购买更多（每个 ${price}）",
    "recentActivity": "最近活动",
    "purchaseAdditional": "购买额外席位",
    "packagePromo": "需要多个席位？通过我们的完整套餐获得更好的价值。",
    "viewPackage": "查看传奇套餐（$29）",
    "types": {
      "project": {
        "title": "项目代金券",
        "description": "创建新的家庭故事项目"
      },
      "facilitator": {
        "title": "协调员席位",
        "description": "邀请协调员帮助管理项目"
      },
      "storyteller": {
        "title": "讲述者席位",
        "description": "邀请家庭成员分享他们的故事"
      }
    },
    "purchase": {
      "project": {
        "title": "项目代金券",
        "description": "创建一个额外的家庭故事项目"
      },
      "facilitator": {
        "title": "协调员席位",
        "description": "邀请一位协调员帮助管理项目"
      },
      "storyteller": {
        "title": "讲述者席位",
        "description": "为您的项目邀请一位额外的讲述者"
      },
      "button": "购买"
    },
    "alerts": {
      "purchaseComingSoon": "{type}席位购买功能即将推出"
    }
  },
  'zh-TW': {
    "title": "我的資源",
    "subtitle": "管理您的可用席位並購買額外資源",
    "buyMoreSeats": "購買更多席位",
    "available": "可用",
    "usage": "使用情況",
    "usageStats": "已使用 {used}/{total}",
    "buyMore": "購買更多（每個 ${price}）",
    "recentActivity": "最近活動",
    "purchaseAdditional": "購買額外席位",
    "packagePromo": "需要多個席位？通過我們的完整套餐獲得更好的價值。",
    "viewPackage": "查看傳奇套餐（$29）",
    "types": {
      "project": {
        "title": "項目代金券",
        "description": "創建新的家庭故事項目"
      },
      "facilitator": {
        "title": "協調員席位",
        "description": "邀請協調員幫助管理項目"
      },
      "storyteller": {
        "title": "講述者席位",
        "description": "邀請家庭成員分享他們的故事"
      }
    },
    "purchase": {
      "project": {
        "title": "項目代金券",
        "description": "創建一個額外的家庭故事項目"
      },
      "facilitator": {
        "title": "協調員席位",
        "description": "邀請一位協調員幫助管理項目"
      },
      "storyteller": {
        "title": "講述者席位",
        "description": "為您的項目邀請一位額外的講述者"
      },
      "button": "購買"
    },
    "alerts": {
      "purchaseComingSoon": "{type}席位購買功能即將推出"
    }
  }
};

function updateResourcesTranslations(lang, translations) {
  const filePath = path.join(baseDir, lang, 'resources.json');
  let existingContent = {};
  
  try {
    existingContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.log(`Creating new file for ${lang}`);
  }
  
  // Merge with existing wallet translations
  const mergedContent = {
    ...translations,
    wallet: existingContent.wallet || {}
  };
  
  fs.writeFileSync(filePath, JSON.stringify(mergedContent, null, 2) + '\n');
  console.log(`✓ Updated ${lang}/resources.json`);
}

console.log('Completing resources.json translations for remaining languages...\\n');
for (const [lang, trans] of Object.entries(resourcesTranslations)) {
  updateResourcesTranslations(lang, trans);
}

console.log('\\nAll resources.json translations completed!');
