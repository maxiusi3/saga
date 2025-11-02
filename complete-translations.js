#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

// Read the translation tasks
const tasks = JSON.parse(fs.readFileSync('translation-tasks.json', 'utf8'));

// Language-specific translations for create-project.json
const createProjectTranslations = {
  'es': {
    "form": {
      "projectDetails": "Detalles del Proyecto",
      "projectName": "Nombre del Proyecto",
      "projectNamePlaceholder": "ej., Historias de la Familia García, Memorias del Abuelo",
      "projectDescription": "Descripción del Proyecto",
      "projectDescriptionPlaceholder": "¿Qué tipo de historias quieres grabar? ¿Quién participará?",
      "projectTheme": "Tema del Proyecto",
      "yourRole": "Tu Rol en Este Proyecto",
      "currentBalance": "Saldo Actual",
      "projectVouchers": "Vales de Proyecto",
      "facilitatorSeats": "Asientos de Facilitador",
      "storytellerSeats": "Asientos de Narrador",
      "cancel": "Cancelar",
      "createProject": "Crear Proyecto",
      "creating": "Creando..."
    },
    "themes": {
      "familyMemories": {
        "name": "Memorias Familiares",
        "description": "Captura historias de diferentes generaciones"
      },
      "lifeJourney": {
        "name": "Viaje de Vida",
        "description": "Documenta hitos personales y experiencias"
      },
      "culturalHeritage": {
        "name": "Herencia Cultural",
        "description": "Preserva tradiciones e historias culturales"
      },
      "professionalLegacy": {
        "name": "Legado Profesional",
        "description": "Comparte experiencias profesionales y sabiduría"
      }
    },
    "roles": {
      "storyteller": {
        "name": "Narrador",
        "description": "Graba y comparte tus historias",
        "resourceCost": "Costo de Recursos: 1 asiento de Narrador"
      },
      "facilitator": {
        "name": "Facilitador",
        "description": "Gestiona el proyecto e invita a otros",
        "resourceCost": "Costo de Recursos: 1 asiento de Facilitador"
      }
    },
    "info": {
      "title": "¿Qué sucede después?",
      "items": {
        "0": "Serás el facilitador del proyecto con acceso completo",
        "1": "Invita a miembros de la familia como narradores",
        "2": "Comienza a grabar y organizar historias",
        "3": "Usa IA para generar indicaciones y resúmenes"
      }
    },
    "errors": {
      "fetchBalance": "No se puede obtener información del saldo de recursos",
      "insufficientVouchers": "Vales de proyecto insuficientes, por favor compra más recursos",
      "insufficientSeats": "Asientos de {role} insuficientes, por favor compra más recursos",
      "createFailed": "Error al crear el proyecto, por favor intenta de nuevo"
    },
    "success": {
      "created": "¡Proyecto creado exitosamente!"
    }
  },
  'fr': {
    "form": {
      "projectDetails": "Détails du Projet",
      "projectName": "Nom du Projet",
      "projectNamePlaceholder": "ex., Histoires de la Famille Dupont, Mémoires de Grand-père",
      "projectDescription": "Description du Projet",
      "projectDescriptionPlaceholder": "Quel type d'histoires voulez-vous enregistrer ? Qui participera ?",
      "projectTheme": "Thème du Projet",
      "yourRole": "Votre Rôle dans ce Projet",
      "currentBalance": "Solde Actuel",
      "projectVouchers": "Bons de Projet",
      "facilitatorSeats": "Sièges de Facilitateur",
      "storytellerSeats": "Sièges de Conteur",
      "cancel": "Annuler",
      "createProject": "Créer un Projet",
      "creating": "Création..."
    },
    "themes": {
      "familyMemories": {
        "name": "Mémoires Familiales",
        "description": "Capturez des histoires de différentes générations"
      },
      "lifeJourney": {
        "name": "Parcours de Vie",
        "description": "Documentez les étapes personnelles et les expériences"
      },
      "culturalHeritage": {
        "name": "Patrimoine Culturel",
        "description": "Préservez les traditions et les histoires culturelles"
      },
      "professionalLegacy": {
        "name": "Héritage Professionnel",
        "description": "Partagez les expériences professionnelles et la sagesse"
      }
    },
    "roles": {
      "storyteller": {
        "name": "Conteur",
        "description": "Enregistrez et partagez vos histoires",
        "resourceCost": "Coût des Ressources : 1 siège de Conteur"
      },
      "facilitator": {
        "name": "Facilitateur",
        "description": "Gérez le projet et invitez d'autres personnes",
        "resourceCost": "Coût des Ressources : 1 siège de Facilitateur"
      }
    },
    "info": {
      "title": "Que se passe-t-il ensuite ?",
      "items": {
        "0": "Vous serez le facilitateur du projet avec un accès complet",
        "1": "Invitez des membres de la famille en tant que conteurs",
        "2": "Commencez à enregistrer et organiser les histoires",
        "3": "Utilisez l'IA pour générer des invites et des résumés"
      }
    },
    "errors": {
      "fetchBalance": "Impossible de récupérer les informations sur le solde des ressources",
      "insufficientVouchers": "Bons de projet insuffisants, veuillez acheter plus de ressources",
      "insufficientSeats": "Sièges de {role} insuffisants, veuillez acheter plus de ressources",
      "createFailed": "Échec de la création du projet, veuillez réessayer"
    },
    "success": {
      "created": "Projet créé avec succès !"
    }
  },
  'ja': {
    "form": {
      "projectDetails": "プロジェクト詳細",
      "projectName": "プロジェクト名",
      "projectNamePlaceholder": "例：田中家の物語、おじいちゃんの回想録",
      "projectDescription": "プロジェクトの説明",
      "projectDescriptionPlaceholder": "どのような物語を記録したいですか？誰が参加しますか？",
      "projectTheme": "プロジェクトテーマ",
      "yourRole": "このプロジェクトでのあなたの役割",
      "currentBalance": "現在の残高",
      "projectVouchers": "プロジェクトバウチャー",
      "facilitatorSeats": "ファシリテーター席",
      "storytellerSeats": "ストーリーテラー席",
      "cancel": "キャンセル",
      "createProject": "プロジェクトを作成",
      "creating": "作成中..."
    },
    "themes": {
      "familyMemories": {
        "name": "家族の思い出",
        "description": "異なる世代の物語を記録"
      },
      "lifeJourney": {
        "name": "人生の旅",
        "description": "個人的なマイルストーンと経験を記録"
      },
      "culturalHeritage": {
        "name": "文化遺産",
        "description": "伝統と文化的な物語を保存"
      },
      "professionalLegacy": {
        "name": "職業的遺産",
        "description": "キャリア経験と知恵を共有"
      }
    },
    "roles": {
      "storyteller": {
        "name": "ストーリーテラー",
        "description": "あなたの物語を記録して共有",
        "resourceCost": "リソースコスト：ストーリーテラー席1つ"
      },
      "facilitator": {
        "name": "ファシリテーター",
        "description": "プロジェクトを管理し、他の人を招待",
        "resourceCost": "リソースコスト：ファシリテーター席1つ"
      }
    },
    "info": {
      "title": "次に何が起こりますか？",
      "items": {
        "0": "完全なアクセス権を持つプロジェクトファシリテーターになります",
        "1": "家族をストーリーテラーとして招待",
        "2": "物語の記録と整理を開始",
        "3": "AIを使用してプロンプトと要約を生成"
      }
    },
    "errors": {
      "fetchBalance": "リソース残高情報を取得できません",
      "insufficientVouchers": "プロジェクトバウチャーが不足しています。もっとリソースを購入してください",
      "insufficientSeats": "{role}席が不足しています。もっとリソースを購入してください",
      "createFailed": "プロジェクトの作成に失敗しました。もう一度お試しください"
    },
    "success": {
      "created": "プロジェクトが正常に作成されました！"
    }
  },
  'ko': {
    "form": {
      "projectDetails": "프로젝트 세부정보",
      "projectName": "프로젝트 이름",
      "projectNamePlaceholder": "예: 김가 이야기, 할아버지의 회고록",
      "projectDescription": "프로젝트 설명",
      "projectDescriptionPlaceholder": "어떤 이야기를 기록하고 싶으신가요? 누가 참여하나요?",
      "projectTheme": "프로젝트 테마",
      "yourRole": "이 프로젝트에서의 역할",
      "currentBalance": "현재 잔액",
      "projectVouchers": "프로젝트 바우처",
      "facilitatorSeats": "진행자 좌석",
      "storytellerSeats": "이야기꾼 좌석",
      "cancel": "취소",
      "createProject": "프로젝트 만들기",
      "creating": "생성 중..."
    },
    "themes": {
      "familyMemories": {
        "name": "가족 추억",
        "description": "여러 세대의 이야기 기록"
      },
      "lifeJourney": {
        "name": "인생 여정",
        "description": "개인적인 이정표와 경험 기록"
      },
      "culturalHeritage": {
        "name": "문화 유산",
        "description": "전통과 문화 이야기 보존"
      },
      "professionalLegacy": {
        "name": "직업적 유산",
        "description": "경력 경험과 지혜 공유"
      }
    },
    "roles": {
      "storyteller": {
        "name": "이야기꾼",
        "description": "이야기를 기록하고 공유",
        "resourceCost": "리소스 비용: 이야기꾼 좌석 1개"
      },
      "facilitator": {
        "name": "진행자",
        "description": "프로젝트 관리 및 다른 사람 초대",
        "resourceCost": "리소스 비용: 진행자 좌석 1개"
      }
    },
    "info": {
      "title": "다음에 무슨 일이 일어나나요?",
      "items": {
        "0": "전체 액세스 권한이 있는 프로젝트 진행자가 됩니다",
        "1": "가족 구성원을 이야기꾼으로 초대",
        "2": "이야기 기록 및 정리 시작",
        "3": "AI를 사용하여 프롬프트 및 요약 생성"
      }
    },
    "errors": {
      "fetchBalance": "리소스 잔액 정보를 가져올 수 없습니다",
      "insufficientVouchers": "프로젝트 바우처가 부족합니다. 더 많은 리소스를 구매하세요",
      "insufficientSeats": "{role} 좌석이 부족합니다. 더 많은 리소스를 구매하세요",
      "createFailed": "프로젝트 생성에 실패했습니다. 다시 시도하세요"
    },
    "success": {
      "created": "프로젝트가 성공적으로 생성되었습니다!"
    }
  },
  'pt': {
    "form": {
      "projectDetails": "Detalhes do Projeto",
      "projectName": "Nome do Projeto",
      "projectNamePlaceholder": "ex., Histórias da Família Silva, Memórias do Vovô",
      "projectDescription": "Descrição do Projeto",
      "projectDescriptionPlaceholder": "Que tipo de histórias você quer gravar? Quem vai participar?",
      "projectTheme": "Tema do Projeto",
      "yourRole": "Seu Papel neste Projeto",
      "currentBalance": "Saldo Atual",
      "projectVouchers": "Vouchers de Projeto",
      "facilitatorSeats": "Assentos de Facilitador",
      "storytellerSeats": "Assentos de Contador de Histórias",
      "cancel": "Cancelar",
      "createProject": "Criar Projeto",
      "creating": "Criando..."
    },
    "themes": {
      "familyMemories": {
        "name": "Memórias Familiares",
        "description": "Capture histórias de diferentes gerações"
      },
      "lifeJourney": {
        "name": "Jornada de Vida",
        "description": "Documente marcos pessoais e experiências"
      },
      "culturalHeritage": {
        "name": "Patrimônio Cultural",
        "description": "Preserve tradições e histórias culturais"
      },
      "professionalLegacy": {
        "name": "Legado Profissional",
        "description": "Compartilhe experiências profissionais e sabedoria"
      }
    },
    "roles": {
      "storyteller": {
        "name": "Contador de Histórias",
        "description": "Grave e compartilhe suas histórias",
        "resourceCost": "Custo de Recursos: 1 assento de Contador de Histórias"
      },
      "facilitator": {
        "name": "Facilitador",
        "description": "Gerencie o projeto e convide outras pessoas",
        "resourceCost": "Custo de Recursos: 1 assento de Facilitador"
      }
    },
    "info": {
      "title": "O que acontece a seguir?",
      "items": {
        "0": "Você será o facilitador do projeto com acesso completo",
        "1": "Convide membros da família como contadores de histórias",
        "2": "Comece a gravar e organizar histórias",
        "3": "Use IA para gerar prompts e resumos"
      }
    },
    "errors": {
      "fetchBalance": "Não foi possível obter informações do saldo de recursos",
      "insufficientVouchers": "Vouchers de projeto insuficientes, por favor compre mais recursos",
      "insufficientSeats": "Assentos de {role} insuficientes, por favor compre mais recursos",
      "createFailed": "Falha ao criar projeto, por favor tente novamente"
    },
    "success": {
      "created": "Projeto criado com sucesso!"
    }
  }
};

function applyTranslations(lang, file, translations) {
  const filePath = path.join(baseDir, lang, file);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  function applyRecursive(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key]) target[key] = {};
        applyRecursive(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }
  
  applyRecursive(content, translations);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`✓ Updated ${lang}/${file}`);
}

// Apply create-project translations
console.log('Applying create-project.json translations...\n');
for (const [lang, trans] of Object.entries(createProjectTranslations)) {
  applyTranslations(lang, 'create-project.json', trans);
}

console.log('\nTranslations applied successfully!');
console.log('\nRun "node translation-report.js" to see the updated status.');
