const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'packages/web/public/locales');

const translations = {
  'ja': {
    "title": "設定",
    "description": "アカウントの環境設定とプライバシー設定を管理",
    "loading": "環境設定を読み込んでいます...",
    "userInfo": {
      "title": "ユーザー情報",
      "changePhoto": "写真を変更",
      "photoHint": "JPG、PNG、またはGIF。最大サイズ2MB。",
      "fullName": "フルネーム",
      "email": "メールアドレス",
      "phone": "電話番号",
      "saveChanges": "変更を保存"
    },
    "quickAccess": {
      "title": "クイックアクセス",
      "description": "より良い使いやすさのために、アクセシビリティと表示設定を素早く調整します。",
      "fontSizeCurrent": "現在",
      "save": "クイックアクセス設定を保存"
    },
    "audio": {
      "title": "オーディオ設定",
      "volume": "音量",
      "quality": "オーディオ品質",
      "qualityLow": "低（高速読み込み）",
      "qualityMedium": "中（バランス）",
      "qualityHigh": "高（最高品質）"
    },
    "privacy": {
      "title": "プライバシーとセキュリティ",
      "profileVisibility": {
        "title": "プロフィールの公開範囲",
        "description": "他の家族メンバーにプロフィールを公開"
      },
      "storySharing": {
        "title": "ストーリー共有",
        "description": "他の人があなたのストーリーを共有できるようにする"
      },
      "dataAnalytics": {
        "title": "データ分析",
        "description": "使用データでサービス改善に協力"
      },
      "twoFactor": {
        "title": "2段階認証",
        "description": "追加のセキュリティレイヤーを追加"
      }
    },
    "notifications": {
      "title": "通知",
      "email": {
        "title": "メール通知",
        "description": "メールで更新を受け取る"
      },
      "push": {
        "title": "プッシュ通知",
        "description": "デバイスで通知を受け取る"
      },
      "weeklyDigest": {
        "title": "週間ダイジェスト",
        "description": "家族の活動の週間サマリー"
      },
      "save": "通知設定を保存"
    },
    "languageRegion": {
      "title": "言語と地域"
    },
    "dataManagement": {
      "title": "データ管理",
      "dataPrivacy": "データプライバシー",
      "dataPrivacyDesc": "データの使用方法を制御"
    },
    "dangerZone": {
      "title": "危険ゾーン"
    },
    "account": {
      "title": "アカウント管理",
      "changePassword": {
        "title": "パスワード変更",
        "description": "アカウントパスワードを更新",
        "button": "変更"
      },
      "twoFactor": {
        "title": "2段階認証",
        "description": "アカウントに追加のセキュリティを追加",
        "button": "設定"
      },
      "devices": {
        "title": "接続されたデバイス",
        "description": "ログインしているデバイスを管理",
        "button": "管理"
      },
      "deleteAccount": {
        "title": "アカウント削除",
        "description": "アカウントとすべての関連データを完全に削除します。この操作は元に戻せません。",
        "button": "アカウント削除",
        "warning": "この操作は元に戻せません"
      },
      "exportData": {
        "title": "データをエクスポート",
        "description": "すべてのストーリーとデータをダウンロード",
        "button": "エクスポート"
      }
    }
  },
  'zh-CN': {
    "title": "设置",
    "description": "管理您的账户偏好设置和隐私设置",
    "loading": "正在加载您的偏好设置...",
    "userInfo": {
      "title": "用户信息",
      "changePhoto": "更改照片",
      "photoHint": "JPG、PNG 或 GIF。最大 2MB。",
      "fullName": "全名",
      "email": "电子邮件地址",
      "phone": "电话号码",
      "saveChanges": "保存更改"
    },
    "quickAccess": {
      "title": "快速访问",
      "description": "快速调整辅助功能和显示设置以获得更好的可用性。",
      "fontSizeCurrent": "当前",
      "save": "保存快速访问设置"
    },
    "audio": {
      "title": "音频设置",
      "volume": "音量",
      "quality": "音频质量",
      "qualityLow": "低（加载更快）",
      "qualityMedium": "中（平衡）",
      "qualityHigh": "高（最佳质量）"
    },
    "privacy": {
      "title": "隐私与安全",
      "profileVisibility": {
        "title": "个人资料可见性",
        "description": "让其他家庭成员看到您的个人资料"
      },
      "storySharing": {
        "title": "故事分享",
        "description": "允许他人分享您的故事"
      },
      "dataAnalytics": {
        "title": "数据分析",
        "description": "通过使用数据帮助改进我们的服务"
      },
      "twoFactor": {
        "title": "双因素认证",
        "description": "添加额外的安全层"
      }
    },
    "notifications": {
      "title": "通知",
      "email": {
        "title": "电子邮件通知",
        "description": "通过电子邮件接收更新"
      },
      "push": {
        "title": "推送通知",
        "description": "在您的设备上接收通知"
      },
      "weeklyDigest": {
        "title": "每周摘要",
        "description": "家庭活动的每周摘要"
      },
      "save": "保存通知设置"
    },
    "languageRegion": {
      "title": "语言和地区"
    },
    "dataManagement": {
      "title": "数据管理",
      "dataPrivacy": "数据隐私",
      "dataPrivacyDesc": "控制数据的使用方式"
    },
    "dangerZone": {
      "title": "危险区域"
    },
    "account": {
      "title": "账户管理",
      "changePassword": {
        "title": "更改密码",
        "description": "更新您的账户密码",
        "button": "更改"
      },
      "twoFactor": {
        "title": "双因素认证",
        "description": "为您的账户添加额外的安全性",
        "button": "设置"
      },
      "devices": {
        "title": "已连接设备",
        "description": "管理您已登录的设备",
        "button": "管理"
      },
      "deleteAccount": {
        "title": "删除账户",
        "description": "永久删除您的账户和所有相关数据。此操作无法撤销。",
        "button": "删除账户",
        "warning": "此操作无法撤销"
      },
      "exportData": {
        "title": "导出我的数据",
        "description": "下载所有故事和数据",
        "button": "导出"
      }
    }
  },
  'zh-TW': {
    "title": "設定",
    "description": "管理您的帳戶偏好設定和隱私設定",
    "loading": "正在載入您的偏好設定...",
    "userInfo": {
      "title": "使用者資訊",
      "changePhoto": "更改照片",
      "photoHint": "JPG、PNG 或 GIF。最大 2MB。",
      "fullName": "全名",
      "email": "電子郵件地址",
      "phone": "電話號碼",
      "saveChanges": "儲存變更"
    },
    "quickAccess": {
      "title": "快速存取",
      "description": "快速調整輔助功能和顯示設定以獲得更好的可用性。",
      "fontSizeCurrent": "目前",
      "save": "儲存快速存取設定"
    },
    "audio": {
      "title": "音訊設定",
      "volume": "音量",
      "quality": "音訊品質",
      "qualityLow": "低（載入更快）",
      "qualityMedium": "中（平衡）",
      "qualityHigh": "高（最佳品質）"
    },
    "privacy": {
      "title": "隱私與安全",
      "profileVisibility": {
        "title": "個人資料可見性",
        "description": "讓其他家庭成員看到您的個人資料"
      },
      "storySharing": {
        "title": "故事分享",
        "description": "允許他人分享您的故事"
      },
      "dataAnalytics": {
        "title": "資料分析",
        "description": "透過使用資料幫助改進我們的服務"
      },
      "twoFactor": {
        "title": "雙因素驗證",
        "description": "新增額外的安全層"
      }
    },
    "notifications": {
      "title": "通知",
      "email": {
        "title": "電子郵件通知",
        "description": "透過電子郵件接收更新"
      },
      "push": {
        "title": "推播通知",
        "description": "在您的裝置上接收通知"
      },
      "weeklyDigest": {
        "title": "每週摘要",
        "description": "家庭活動的每週摘要"
      },
      "save": "儲存通知設定"
    },
    "languageRegion": {
      "title": "語言和地區"
    },
    "dataManagement": {
      "title": "資料管理",
      "dataPrivacy": "資料隱私",
      "dataPrivacyDesc": "控制資料的使用方式"
    },
    "dangerZone": {
      "title": "危險區域"
    },
    "account": {
      "title": "帳戶管理",
      "changePassword": {
        "title": "變更密碼",
        "description": "更新您的帳戶密碼",
        "button": "變更"
      },
      "twoFactor": {
        "title": "雙因素驗證",
        "description": "為您的帳戶新增額外的安全性",
        "button": "設定"
      },
      "devices": {
        "title": "已連接裝置",
        "description": "管理您已登入的裝置",
        "button": "管理"
      },
      "deleteAccount": {
        "title": "刪除帳戶",
        "description": "永久刪除您的帳戶和所有相關資料。此操作無法復原。",
        "button": "刪除帳戶",
        "warning": "此操作無法復原"
      },
      "exportData": {
        "title": "匯出我的資料",
        "description": "下載所有故事和資料",
        "button": "匯出"
      }
    }
  },
  'fr': {
    "title": "Paramètres",
    "description": "Gérez vos préférences de compte et paramètres de confidentialité",
    "loading": "Chargement de vos préférences...",
    "userInfo": {
      "title": "Informations utilisateur",
      "changePhoto": "Changer la photo",
      "photoHint": "JPG, PNG ou GIF. Taille max 2MB.",
      "fullName": "Nom complet",
      "email": "Adresse e-mail",
      "phone": "Numéro de téléphone",
      "saveChanges": "Enregistrer les modifications"
    },
    "quickAccess": {
      "title": "Accès rapide",
      "description": "Ajustez rapidement les paramètres d'accessibilité et d'affichage pour une meilleure utilisabilité.",
      "fontSizeCurrent": "Actuel",
      "save": "Enregistrer les paramètres d'accès rapide"
    },
    "audio": {
      "title": "Paramètres audio",
      "volume": "Volume",
      "quality": "Qualité audio",
      "qualityLow": "Faible (Chargement plus rapide)",
      "qualityMedium": "Moyen (Équilibré)",
      "qualityHigh": "Élevé (Meilleure qualité)"
    },
    "privacy": {
      "title": "Confidentialité et sécurité",
      "profileVisibility": {
        "title": "Visibilité du profil",
        "description": "Rendre votre profil visible aux autres membres de la famille"
      },
      "storySharing": {
        "title": "Partage d'histoires",
        "description": "Permettre aux autres de partager vos histoires"
      },
      "dataAnalytics": {
        "title": "Analyse de données",
        "description": "Aidez à améliorer notre service avec les données d'utilisation"
      },
      "twoFactor": {
        "title": "Authentification à deux facteurs",
        "description": "Ajouter une couche de sécurité supplémentaire"
      }
    },
    "notifications": {
      "title": "Notifications",
      "email": {
        "title": "Notifications par e-mail",
        "description": "Recevoir des mises à jour par e-mail"
      },
      "push": {
        "title": "Notifications push",
        "description": "Recevoir des notifications sur vos appareils"
      },
      "weeklyDigest": {
        "title": "Résumé hebdomadaire",
        "description": "Résumé hebdomadaire de l'activité familiale"
      },
      "save": "Enregistrer les paramètres de notification"
    },
    "languageRegion": {
      "title": "Langue et région"
    },
    "dataManagement": {
      "title": "Gestion des données",
      "dataPrivacy": "Confidentialité des données",
      "dataPrivacyDesc": "Contrôler l'utilisation de vos données"
    },
    "dangerZone": {
      "title": "Zone dangereuse"
    },
    "account": {
      "title": "Gestion du compte",
      "changePassword": {
        "title": "Changer le mot de passe",
        "description": "Mettre à jour le mot de passe de votre compte",
        "button": "Changer"
      },
      "twoFactor": {
        "title": "Authentification à deux facteurs",
        "description": "Ajouter une sécurité supplémentaire à votre compte",
        "button": "Configurer"
      },
      "devices": {
        "title": "Appareils connectés",
        "description": "Gérer vos appareils connectés",
        "button": "Gérer"
      },
      "deleteAccount": {
        "title": "Supprimer le compte",
        "description": "Supprimer définitivement votre compte et toutes les données associées. Cette action ne peut pas être annulée.",
        "button": "Supprimer le compte",
        "warning": "Cette action ne peut pas être annulée"
      },
      "exportData": {
        "title": "Exporter mes données",
        "description": "Télécharger toutes vos histoires et données",
        "button": "Exporter"
      }
    }
  },
  'es': {
    "title": "Configuración",
    "description": "Administra tus preferencias de cuenta y configuración de privacidad",
    "loading": "Cargando tus preferencias...",
    "userInfo": {
      "title": "Información del usuario",
      "changePhoto": "Cambiar foto",
      "photoHint": "JPG, PNG o GIF. Tamaño máximo 2MB.",
      "fullName": "Nombre completo",
      "email": "Dirección de correo electrónico",
      "phone": "Número de teléfono",
      "saveChanges": "Guardar cambios"
    },
    "quickAccess": {
      "title": "Acceso rápido",
      "description": "Ajusta rápidamente la configuración de accesibilidad y visualización para una mejor usabilidad.",
      "fontSizeCurrent": "Actual",
      "save": "Guardar configuración de acceso rápido"
    },
    "audio": {
      "title": "Configuración de audio",
      "volume": "Volumen",
      "quality": "Calidad de audio",
      "qualityLow": "Baja (Carga más rápida)",
      "qualityMedium": "Media (Equilibrada)",
      "qualityHigh": "Alta (Mejor calidad)"
    },
    "privacy": {
      "title": "Privacidad y seguridad",
      "profileVisibility": {
        "title": "Visibilidad del perfil",
        "description": "Hacer tu perfil visible para otros miembros de la familia"
      },
      "storySharing": {
        "title": "Compartir historias",
        "description": "Permitir que otros compartan tus historias"
      },
      "dataAnalytics": {
        "title": "Análisis de datos",
        "description": "Ayuda a mejorar nuestro servicio con datos de uso"
      },
      "twoFactor": {
        "title": "Autenticación de dos factores",
        "description": "Agregar una capa adicional de seguridad"
      }
    },
    "notifications": {
      "title": "Notificaciones",
      "email": {
        "title": "Notificaciones por correo electrónico",
        "description": "Recibir actualizaciones por correo electrónico"
      },
      "push": {
        "title": "Notificaciones push",
        "description": "Recibir notificaciones en tus dispositivos"
      },
      "weeklyDigest": {
        "title": "Resumen semanal",
        "description": "Resumen semanal de la actividad familiar"
      },
      "save": "Guardar configuración de notificaciones"
    },
    "languageRegion": {
      "title": "Idioma y región"
    },
    "dataManagement": {
      "title": "Gestión de datos",
      "dataPrivacy": "Privacidad de datos",
      "dataPrivacyDesc": "Controlar cómo se usan tus datos"
    },
    "dangerZone": {
      "title": "Zona de peligro"
    },
    "account": {
      "title": "Gestión de cuenta",
      "changePassword": {
        "title": "Cambiar contraseña",
        "description": "Actualizar la contraseña de tu cuenta",
        "button": "Cambiar"
      },
      "twoFactor": {
        "title": "Autenticación de dos factores",
        "description": "Agregar seguridad adicional a tu cuenta",
        "button": "Configurar"
      },
      "devices": {
        "title": "Dispositivos conectados",
        "description": "Administrar tus dispositivos conectados",
        "button": "Administrar"
      },
      "deleteAccount": {
        "title": "Eliminar cuenta",
        "description": "Eliminar permanentemente tu cuenta y todos los datos asociados. Esta acción no se puede deshacer.",
        "button": "Eliminar cuenta",
        "warning": "Esta acción no se puede deshacer"
      },
      "exportData": {
        "title": "Exportar mis datos",
        "description": "Descargar todas tus historias y datos",
        "button": "Exportar"
      }
    }
  },
  'pt': {
    "title": "Configurações",
    "description": "Gerencie suas preferências de conta e configurações de privacidade",
    "loading": "Carregando suas preferências...",
    "userInfo": {
      "title": "Informações do usuário",
      "changePhoto": "Alterar foto",
      "photoHint": "JPG, PNG ou GIF. Tamanho máximo 2MB.",
      "fullName": "Nome completo",
      "email": "Endereço de e-mail",
      "phone": "Número de telefone",
      "saveChanges": "Salvar alterações"
    },
    "quickAccess": {
      "title": "Acesso rápido",
      "description": "Ajuste rapidamente as configurações de acessibilidade e exibição para melhor usabilidade.",
      "fontSizeCurrent": "Atual",
      "save": "Salvar configurações de acesso rápido"
    },
    "audio": {
      "title": "Configurações de áudio",
      "volume": "Volume",
      "quality": "Qualidade de áudio",
      "qualityLow": "Baixa (Carregamento mais rápido)",
      "qualityMedium": "Média (Equilibrada)",
      "qualityHigh": "Alta (Melhor qualidade)"
    },
    "privacy": {
      "title": "Privacidade e segurança",
      "profileVisibility": {
        "title": "Visibilidade do perfil",
        "description": "Tornar seu perfil visível para outros membros da família"
      },
      "storySharing": {
        "title": "Compartilhamento de histórias",
        "description": "Permitir que outros compartilhem suas histórias"
      },
      "dataAnalytics": {
        "title": "Análise de dados",
        "description": "Ajude a melhorar nosso serviço com dados de uso"
      },
      "twoFactor": {
        "title": "Autenticação de dois fatores",
        "description": "Adicionar uma camada extra de segurança"
      }
    },
    "notifications": {
      "title": "Notificações",
      "email": {
        "title": "Notificações por e-mail",
        "description": "Receber atualizações por e-mail"
      },
      "push": {
        "title": "Notificações push",
        "description": "Receber notificações em seus dispositivos"
      },
      "weeklyDigest": {
        "title": "Resumo semanal",
        "description": "Resumo semanal da atividade familiar"
      },
      "save": "Salvar configurações de notificação"
    },
    "languageRegion": {
      "title": "Idioma e região"
    },
    "dataManagement": {
      "title": "Gerenciamento de dados",
      "dataPrivacy": "Privacidade de dados",
      "dataPrivacyDesc": "Controlar como seus dados são usados"
    },
    "dangerZone": {
      "title": "Zona de perigo"
    },
    "account": {
      "title": "Gerenciamento de conta",
      "changePassword": {
        "title": "Alterar senha",
        "description": "Atualizar a senha da sua conta",
        "button": "Alterar"
      },
      "twoFactor": {
        "title": "Autenticação de dois fatores",
        "description": "Adicionar segurança extra à sua conta",
        "button": "Configurar"
      },
      "devices": {
        "title": "Dispositivos conectados",
        "description": "Gerenciar seus dispositivos conectados",
        "button": "Gerenciar"
      },
      "deleteAccount": {
        "title": "Excluir conta",
        "description": "Excluir permanentemente sua conta e todos os dados associados. Esta ação não pode ser desfeita.",
        "button": "Excluir conta",
        "warning": "Esta ação não pode ser desfeita"
      },
      "exportData": {
        "title": "Exportar meus dados",
        "description": "Baixar todas as suas histórias e dados",
        "button": "Exportar"
      }
    }
  }
};

// Update each language file
Object.keys(translations).forEach(lang => {
  const filePath = path.join(localesDir, lang, 'settings.json');
  
  try {
    let existingData = {};
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    
    // Merge with existing data
    const mergedData = { ...existingData, ...translations[lang] };
    
    fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
    console.log(`✅ Updated ${lang}/settings.json`);
  } catch (error) {
    console.error(`❌ Error updating ${lang}/settings.json:`, error.message);
  }
});

console.log('\n✅ All settings translations updated!');
