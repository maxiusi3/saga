const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

const additionalTranslations = {
  en: {
    "detail": {
      "backToStories": "Back to Stories",
      "aiSuggestedQuestions": "AI Suggested Questions",
      "addToFavorites": "Add to Favorites",
      "downloadAudio": "Download Audio",
      "transcript": "Transcript",
      "edit": "Edit",
      "save": "Save",
      "cancel": "Cancel",
      "interactions": "Interactions",
      "storyActions": "Story Actions",
      "recorded": "Recorded",
      "familyComments": "Family Comments",
      "addComment": "Add Comment",
      "commentPlaceholder": "Share your thoughts about this story...",
      "comment": "Comment",
      "followUp": "Follow-up",
      "reply": "Reply"
    }
  },
  es: {
    "detail": {
      "backToStories": "Volver a Historias",
      "aiSuggestedQuestions": "Preguntas Sugeridas por IA",
      "addToFavorites": "Añadir a Favoritos",
      "downloadAudio": "Descargar Audio",
      "transcript": "Transcripción",
      "edit": "Editar",
      "save": "Guardar",
      "cancel": "Cancelar",
      "interactions": "Interacciones",
      "storyActions": "Acciones de Historia",
      "recorded": "Grabado",
      "familyComments": "Comentarios Familiares",
      "addComment": "Añadir Comentario",
      "commentPlaceholder": "Comparte tus pensamientos sobre esta historia...",
      "comment": "Comentario",
      "followUp": "Seguimiento",
      "reply": "Responder"
    }
  },
  fr: {
    "detail": {
      "backToStories": "Retour aux Histoires",
      "aiSuggestedQuestions": "Questions Suggérées par IA",
      "addToFavorites": "Ajouter aux Favoris",
      "downloadAudio": "Télécharger l'Audio",
      "transcript": "Transcription",
      "edit": "Modifier",
      "save": "Enregistrer",
      "cancel": "Annuler",
      "interactions": "Interactions",
      "storyActions": "Actions d'Histoire",
      "recorded": "Enregistré",
      "familyComments": "Commentaires Familiaux",
      "addComment": "Ajouter un Commentaire",
      "commentPlaceholder": "Partagez vos pensées sur cette histoire...",
      "comment": "Commentaire",
      "followUp": "Suivi",
      "reply": "Répondre"
    }
  },
  ja: {
    "detail": {
      "backToStories": "ストーリーに戻る",
      "aiSuggestedQuestions": "AI提案の質問",
      "addToFavorites": "お気に入りに追加",
      "downloadAudio": "音声をダウンロード",
      "transcript": "文字起こし",
      "edit": "編集",
      "save": "保存",
      "cancel": "キャンセル",
      "interactions": "インタラクション",
      "storyActions": "ストーリーアクション",
      "recorded": "録音済み",
      "familyComments": "家族のコメント",
      "addComment": "コメントを追加",
      "commentPlaceholder": "この物語についてあなたの考えを共有してください...",
      "comment": "コメント",
      "followUp": "フォローアップ",
      "reply": "返信"
    }
  },
  ko: {
    "detail": {
      "backToStories": "스토리로 돌아가기",
      "aiSuggestedQuestions": "AI 제안 질문",
      "addToFavorites": "즐겨찾기에 추가",
      "downloadAudio": "오디오 다운로드",
      "transcript": "대본",
      "edit": "편집",
      "save": "저장",
      "cancel": "취소",
      "interactions": "상호작용",
      "storyActions": "스토리 작업",
      "recorded": "녹음됨",
      "familyComments": "가족 댓글",
      "addComment": "댓글 추가",
      "commentPlaceholder": "이 이야기에 대한 생각을 공유하세요...",
      "comment": "댓글",
      "followUp": "후속 조치",
      "reply": "답글"
    }
  },
  pt: {
    "detail": {
      "backToStories": "Voltar para Histórias",
      "aiSuggestedQuestions": "Perguntas Sugeridas por IA",
      "addToFavorites": "Adicionar aos Favoritos",
      "downloadAudio": "Baixar Áudio",
      "transcript": "Transcrição",
      "edit": "Editar",
      "save": "Salvar",
      "cancel": "Cancelar",
      "interactions": "Interações",
      "storyActions": "Ações da História",
      "recorded": "Gravado",
      "familyComments": "Comentários da Família",
      "addComment": "Adicionar Comentário",
      "commentPlaceholder": "Compartilhe seus pensamentos sobre esta história...",
      "comment": "Comentário",
      "followUp": "Acompanhamento",
      "reply": "Responder"
    }
  },
  "zh-CN": {
    "detail": {
      "backToStories": "返回故事",
      "aiSuggestedQuestions": "AI建议的问题",
      "addToFavorites": "添加到收藏",
      "downloadAudio": "下载音频",
      "transcript": "文字记录",
      "edit": "编辑",
      "save": "保存",
      "cancel": "取消",
      "interactions": "互动",
      "storyActions": "故事操作",
      "recorded": "已录制",
      "familyComments": "家庭评论",
      "addComment": "添加评论",
      "commentPlaceholder": "分享您对这个故事的想法...",
      "comment": "评论",
      "followUp": "后续",
      "reply": "回复"
    }
  },
  "zh-TW": {
    "detail": {
      "backToStories": "返回故事",
      "aiSuggestedQuestions": "AI建議的問題",
      "addToFavorites": "添加到收藏",
      "downloadAudio": "下載音訊",
      "transcript": "文字記錄",
      "edit": "編輯",
      "save": "儲存",
      "cancel": "取消",
      "interactions": "互動",
      "storyActions": "故事操作",
      "recorded": "已錄製",
      "familyComments": "家庭評論",
      "addComment": "添加評論",
      "commentPlaceholder": "分享您對這個故事的想法...",
      "comment": "評論",
      "followUp": "後續",
      "reply": "回覆"
    }
  }
};

for (const [lang, translations] of Object.entries(additionalTranslations)) {
  const filePath = path.join(baseDir, lang, 'stories.json');
  let existing = {};
  
  try {
    existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.log(`File not found for ${lang}`);
  }
  
  // Merge detail section
  const merged = {
    ...existing,
    detail: {
      ...(existing.detail || {}),
      ...translations.detail
    }
  };
  
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`✓ Updated ${lang}/stories.json`);
}

console.log('\nAll story detail translations added!');
