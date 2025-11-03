const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

const managerTranslations = {
  en: {
    "manager": {
      "title": "Project Invitations",
      "sendNew": "Send New Invitation",
      "emailPlaceholder": "Enter email address",
      "selectRole": "Select role",
      "storyteller": "Storyteller",
      "facilitator": "Facilitator",
      "sendButton": "Send",
      "sending": "Sending...",
      "currentMembers": "Current Members",
      "pendingInvitations": "Pending Invitations",
      "owner": "Owner",
      "active": "Active",
      "pending": "Pending",
      "remove": "Remove",
      "resend": "Resend",
      "cancel": "Cancel",
      "copyLink": "Copy Link",
      "showQR": "Show QR Code",
      "invitationSent": "Invitation sent successfully!",
      "invitationFailed": "Failed to send invitation",
      "linkCopied": "Invitation link copied!",
      "memberRemoved": "Member removed successfully",
      "invitationCancelled": "Invitation cancelled",
      "invitationResent": "Invitation resent successfully"
    }
  },
  es: {
    "manager": {
      "title": "Invitaciones al Proyecto",
      "sendNew": "Enviar Nueva Invitación",
      "emailPlaceholder": "Ingresa dirección de correo",
      "selectRole": "Seleccionar rol",
      "storyteller": "Narrador",
      "facilitator": "Facilitador",
      "sendButton": "Enviar",
      "sending": "Enviando...",
      "currentMembers": "Miembros Actuales",
      "pendingInvitations": "Invitaciones Pendientes",
      "owner": "Propietario",
      "active": "Activo",
      "pending": "Pendiente",
      "remove": "Eliminar",
      "resend": "Reenviar",
      "cancel": "Cancelar",
      "copyLink": "Copiar Enlace",
      "showQR": "Mostrar Código QR",
      "invitationSent": "¡Invitación enviada exitosamente!",
      "invitationFailed": "Error al enviar invitación",
      "linkCopied": "¡Enlace de invitación copiado!",
      "memberRemoved": "Miembro eliminado exitosamente",
      "invitationCancelled": "Invitación cancelada",
      "invitationResent": "Invitación reenviada exitosamente"
    }
  },
  fr: {
    "manager": {
      "title": "Invitations au Projet",
      "sendNew": "Envoyer une Nouvelle Invitation",
      "emailPlaceholder": "Entrez l'adresse email",
      "selectRole": "Sélectionner le rôle",
      "storyteller": "Conteur",
      "facilitator": "Facilitateur",
      "sendButton": "Envoyer",
      "sending": "Envoi...",
      "currentMembers": "Membres Actuels",
      "pendingInvitations": "Invitations en Attente",
      "owner": "Propriétaire",
      "active": "Actif",
      "pending": "En attente",
      "remove": "Supprimer",
      "resend": "Renvoyer",
      "cancel": "Annuler",
      "copyLink": "Copier le Lien",
      "showQR": "Afficher le Code QR",
      "invitationSent": "Invitation envoyée avec succès !",
      "invitationFailed": "Échec de l'envoi de l'invitation",
      "linkCopied": "Lien d'invitation copié !",
      "memberRemoved": "Membre supprimé avec succès",
      "invitationCancelled": "Invitation annulée",
      "invitationResent": "Invitation renvoyée avec succès"
    }
  },
  ja: {
    "manager": {
      "title": "プロジェクト招待",
      "sendNew": "新しい招待を送信",
      "emailPlaceholder": "メールアドレスを入力",
      "selectRole": "役割を選択",
      "storyteller": "ストーリーテラー",
      "facilitator": "ファシリテーター",
      "sendButton": "送信",
      "sending": "送信中...",
      "currentMembers": "現在のメンバー",
      "pendingInvitations": "保留中の招待",
      "owner": "オーナー",
      "active": "アクティブ",
      "pending": "保留中",
      "remove": "削除",
      "resend": "再送信",
      "cancel": "キャンセル",
      "copyLink": "リンクをコピー",
      "showQR": "QRコードを表示",
      "invitationSent": "招待が正常に送信されました！",
      "invitationFailed": "招待の送信に失敗しました",
      "linkCopied": "招待リンクがコピーされました！",
      "memberRemoved": "メンバーが正常に削除されました",
      "invitationCancelled": "招待がキャンセルされました",
      "invitationResent": "招待が正常に再送信されました"
    }
  },
  ko: {
    "manager": {
      "title": "프로젝트 초대",
      "sendNew": "새 초대 보내기",
      "emailPlaceholder": "이메일 주소 입력",
      "selectRole": "역할 선택",
      "storyteller": "이야기꾼",
      "facilitator": "진행자",
      "sendButton": "보내기",
      "sending": "전송 중...",
      "currentMembers": "현재 멤버",
      "pendingInvitations": "대기 중인 초대",
      "owner": "소유자",
      "active": "활성",
      "pending": "대기 중",
      "remove": "제거",
      "resend": "재전송",
      "cancel": "취소",
      "copyLink": "링크 복사",
      "showQR": "QR 코드 표시",
      "invitationSent": "초대가 성공적으로 전송되었습니다!",
      "invitationFailed": "초대 전송에 실패했습니다",
      "linkCopied": "초대 링크가 복사되었습니다!",
      "memberRemoved": "멤버가 성공적으로 제거되었습니다",
      "invitationCancelled": "초대가 취소되었습니다",
      "invitationResent": "초대가 성공적으로 재전송되었습니다"
    }
  },
  pt: {
    "manager": {
      "title": "Convites do Projeto",
      "sendNew": "Enviar Novo Convite",
      "emailPlaceholder": "Digite o endereço de email",
      "selectRole": "Selecionar função",
      "storyteller": "Contador de Histórias",
      "facilitator": "Facilitador",
      "sendButton": "Enviar",
      "sending": "Enviando...",
      "currentMembers": "Membros Atuais",
      "pendingInvitations": "Convites Pendentes",
      "owner": "Proprietário",
      "active": "Ativo",
      "pending": "Pendente",
      "remove": "Remover",
      "resend": "Reenviar",
      "cancel": "Cancelar",
      "copyLink": "Copiar Link",
      "showQR": "Mostrar Código QR",
      "invitationSent": "Convite enviado com sucesso!",
      "invitationFailed": "Falha ao enviar convite",
      "linkCopied": "Link de convite copiado!",
      "memberRemoved": "Membro removido com sucesso",
      "invitationCancelled": "Convite cancelado",
      "invitationResent": "Convite reenviado com sucesso"
    }
  },
  "zh-CN": {
    "manager": {
      "title": "项目邀请",
      "sendNew": "发送新邀请",
      "emailPlaceholder": "输入电子邮件地址",
      "selectRole": "选择角色",
      "storyteller": "讲述者",
      "facilitator": "协调员",
      "sendButton": "发送",
      "sending": "发送中...",
      "currentMembers": "当前成员",
      "pendingInvitations": "待处理的邀请",
      "owner": "所有者",
      "active": "活跃",
      "pending": "待处理",
      "remove": "移除",
      "resend": "重新发送",
      "cancel": "取消",
      "copyLink": "复制链接",
      "showQR": "显示二维码",
      "invitationSent": "邀请已成功发送！",
      "invitationFailed": "发送邀请失败",
      "linkCopied": "邀请链接已复制！",
      "memberRemoved": "成员已成功移除",
      "invitationCancelled": "邀请已取消",
      "invitationResent": "邀请已成功重新发送"
    }
  },
  "zh-TW": {
    "manager": {
      "title": "專案邀請",
      "sendNew": "發送新邀請",
      "emailPlaceholder": "輸入電子郵件地址",
      "selectRole": "選擇角色",
      "storyteller": "講述者",
      "facilitator": "協調員",
      "sendButton": "發送",
      "sending": "發送中...",
      "currentMembers": "當前成員",
      "pendingInvitations": "待處理的邀請",
      "owner": "所有者",
      "active": "活躍",
      "pending": "待處理",
      "remove": "移除",
      "resend": "重新發送",
      "cancel": "取消",
      "copyLink": "複製連結",
      "showQR": "顯示二維碼",
      "invitationSent": "邀請已成功發送！",
      "invitationFailed": "發送邀請失敗",
      "linkCopied": "邀請連結已複製！",
      "memberRemoved": "成員已成功移除",
      "invitationCancelled": "邀請已取消",
      "invitationResent": "邀請已成功重新發送"
    }
  }
};

for (const [lang, translations] of Object.entries(managerTranslations)) {
  const filePath = path.join(baseDir, lang, 'invitations.json');
  let existing = {};
  
  try {
    existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.log(`File not found for ${lang}, creating new`);
  }
  
  const merged = {
    ...existing,
    ...translations
  };
  
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`✓ Updated ${lang}/invitations.json`);
}

console.log('\nAll invitation manager translations added!');
