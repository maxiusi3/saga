const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

// Project Settings Translations
const projectSettingsTranslations = {
  'es': {
    "title": "Gestión de Proyectos",
    "backToProject": "Volver al Proyecto",
    "quickActions": {
      "title": "Acciones Rápidas",
      "inviteMembers": "Invitar Miembros",
      "exportData": "Exportar Datos",
      "shareProject": "Compartir Proyecto"
    },
    "projectStats": {
      "title": "Estadísticas del Proyecto",
      "created": "Creado",
      "stories": "Historias",
      "members": "Miembros"
    },
    "projectOverview": {
      "title": "Resumen del Proyecto",
      "status": {
        "active": "Activo",
        "archived": "Archivado"
      },
      "projectName": "Nombre del Proyecto",
      "projectDescription": "Descripción del Proyecto",
      "save": "Guardar",
      "saving": "Guardando...",
      "enterName": "Ingresa el nombre del proyecto",
      "enterDescription": "Ingresa la descripción del proyecto"
    },
    "memberManagement": {
      "title": "Gestión de Miembros"
    },
    "messages": {
      "nameRequired": "El nombre del proyecto es obligatorio",
      "updateSuccess": "Proyecto actualizado exitosamente",
      "updateFailed": "Error al actualizar el proyecto",
      "memberRemoved": "Miembro eliminado exitosamente",
      "memberRemoveFailed": "Error al eliminar miembro",
      "exportSoon": "¡Función de exportación próximamente!",
      "shareSoon": "¡Función de compartir próximamente!",
      "notFound": "Proyecto no encontrado o acceso denegado",
      "signIn": "Por favor inicia sesión",
      "projectNotFound": "Proyecto no encontrado"
    }
  },
  'fr': {
    "title": "Gestion de Projet",
    "backToProject": "Retour au Projet",
    "quickActions": {
      "title": "Actions Rapides",
      "inviteMembers": "Inviter des Membres",
      "exportData": "Exporter les Données",
      "shareProject": "Partager le Projet"
    },
    "projectStats": {
      "title": "Statistiques du Projet",
      "created": "Créé",
      "stories": "Histoires",
      "members": "Membres"
    },
    "projectOverview": {
      "title": "Aperçu du Projet",
      "status": {
        "active": "Actif",
        "archived": "Archivé"
      },
      "projectName": "Nom du Projet",
      "projectDescription": "Description du Projet",
      "save": "Enregistrer",
      "saving": "Enregistrement...",
      "enterName": "Entrez le nom du projet",
      "enterDescription": "Entrez la description du projet"
    },
    "memberManagement": {
      "title": "Gestion des Membres"
    },
    "messages": {
      "nameRequired": "Le nom du projet est requis",
      "updateSuccess": "Projet mis à jour avec succès",
      "updateFailed": "Échec de la mise à jour du projet",
      "memberRemoved": "Membre supprimé avec succès",
      "memberRemoveFailed": "Échec de la suppression du membre",
      "exportSoon": "Fonction d'exportation bientôt disponible !",
      "shareSoon": "Fonction de partage bientôt disponible !",
      "notFound": "Projet introuvable ou accès refusé",
      "signIn": "Veuillez vous connecter",
      "projectNotFound": "Projet introuvable"
    }
  },
  'ja': {
    "title": "プロジェクト管理",
    "backToProject": "プロジェクトに戻る",
    "quickActions": {
      "title": "クイックアクション",
      "inviteMembers": "メンバーを招待",
      "exportData": "データをエクスポート",
      "shareProject": "プロジェクトを共有"
    },
    "projectStats": {
      "title": "プロジェクト統計",
      "created": "作成日",
      "stories": "ストーリー",
      "members": "メンバー"
    },
    "projectOverview": {
      "title": "プロジェクト概要",
      "status": {
        "active": "アクティブ",
        "archived": "アーカイブ済み"
      },
      "projectName": "プロジェクト名",
      "projectDescription": "プロジェクトの説明",
      "save": "保存",
      "saving": "保存中...",
      "enterName": "プロジェクト名を入力",
      "enterDescription": "プロジェクトの説明を入力"
    },
    "memberManagement": {
      "title": "メンバー管理"
    },
    "messages": {
      "nameRequired": "プロジェクト名は必須です",
      "updateSuccess": "プロジェクトが正常に更新されました",
      "updateFailed": "プロジェクトの更新に失敗しました",
      "memberRemoved": "メンバーが正常に削除されました",
      "memberRemoveFailed": "メンバーの削除に失敗しました",
      "exportSoon": "エクスポート機能は近日公開！",
      "shareSoon": "共有機能は近日公開！",
      "notFound": "プロジェクトが見つからないか、アクセスが拒否されました",
      "signIn": "サインインしてください",
      "projectNotFound": "プロジェクトが見つかりません"
    }
  },
  'ko': {
    "title": "프로젝트 관리",
    "backToProject": "프로젝트로 돌아가기",
    "quickActions": {
      "title": "빠른 작업",
      "inviteMembers": "멤버 초대",
      "exportData": "데이터 내보내기",
      "shareProject": "프로젝트 공유"
    },
    "projectStats": {
      "title": "프로젝트 통계",
      "created": "생성됨",
      "stories": "스토리",
      "members": "멤버"
    },
    "projectOverview": {
      "title": "프로젝트 개요",
      "status": {
        "active": "활성",
        "archived": "보관됨"
      },
      "projectName": "프로젝트 이름",
      "projectDescription": "프로젝트 설명",
      "save": "저장",
      "saving": "저장 중...",
      "enterName": "프로젝트 이름 입력",
      "enterDescription": "프로젝트 설명 입력"
    },
    "memberManagement": {
      "title": "멤버 관리"
    },
    "messages": {
      "nameRequired": "프로젝트 이름은 필수입니다",
      "updateSuccess": "프로젝트가 성공적으로 업데이트되었습니다",
      "updateFailed": "프로젝트 업데이트 실패",
      "memberRemoved": "멤버가 성공적으로 제거되었습니다",
      "memberRemoveFailed": "멤버 제거 실패",
      "exportSoon": "내보내기 기능 곧 출시!",
      "shareSoon": "공유 기능 곧 출시!",
      "notFound": "프로젝트를 찾을 수 없거나 액세스가 거부되었습니다",
      "signIn": "로그인하세요",
      "projectNotFound": "프로젝트를 찾을 수 없습니다"
    }
  },
  'pt': {
    "title": "Gerenciamento de Projetos",
    "backToProject": "Voltar ao Projeto",
    "quickActions": {
      "title": "Ações Rápidas",
      "inviteMembers": "Convidar Membros",
      "exportData": "Exportar Dados",
      "shareProject": "Compartilhar Projeto"
    },
    "projectStats": {
      "title": "Estatísticas do Projeto",
      "created": "Criado",
      "stories": "Histórias",
      "members": "Membros"
    },
    "projectOverview": {
      "title": "Visão Geral do Projeto",
      "status": {
        "active": "Ativo",
        "archived": "Arquivado"
      },
      "projectName": "Nome do Projeto",
      "projectDescription": "Descrição do Projeto",
      "save": "Salvar",
      "saving": "Salvando...",
      "enterName": "Digite o nome do projeto",
      "enterDescription": "Digite a descrição do projeto"
    },
    "memberManagement": {
      "title": "Gerenciamento de Membros"
    },
    "messages": {
      "nameRequired": "O nome do projeto é obrigatório",
      "updateSuccess": "Projeto atualizado com sucesso",
      "updateFailed": "Falha ao atualizar o projeto",
      "memberRemoved": "Membro removido com sucesso",
      "memberRemoveFailed": "Falha ao remover membro",
      "exportSoon": "Recurso de exportação em breve!",
      "shareSoon": "Recurso de compartilhamento em breve!",
      "notFound": "Projeto não encontrado ou acesso negado",
      "signIn": "Por favor, faça login",
      "projectNotFound": "Projeto não encontrado"
    }
  }
};

function applyTranslations(lang, file, translations) {
  const filePath = path.join(baseDir, lang, file);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  
  deepMerge(content, translations);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`✓ Updated ${lang}/${file}`);
}

console.log('Applying project-settings.json translations...\n');
for (const [lang, trans] of Object.entries(projectSettingsTranslations)) {
  applyTranslations(lang, 'project-settings.json', trans);
}

console.log('\nProject settings translations completed!');
