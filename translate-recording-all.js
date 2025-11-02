const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

// Complete Recording.json translations for all languages
const recordingTranslations = {
  'es': {
    "title": "Graba Tu Historia",
    "subtitle": "Comparte tus recuerdos con guía impulsada por IA",
    "prompt": "Indicación",
    "networkStatus": {
      "good": "Buena Conexión",
      "poor": "Conexión Lenta",
      "offline": "Modo Sin Conexión"
    },
    "status": {
      "ready": "Listo para Grabar",
      "recording": "Grabando...",
      "paused": "Grabación Pausada",
      "completed": "Grabación Completada",
      "recordingComplete": "Grabación Completa",
      "processing": "Procesando...",
      "uploading": "Subiendo..."
    },
    "actions": {
      "start": "Iniciar Grabación",
      "pause": "Pausar",
      "stop": "Detener",
      "continue": "Continuar",
      "complete": "Completar Grabación",
      "reRecord": "Volver a Grabar",
      "save": "Guardar Historia",
      "startOver": "Empezar de Nuevo",
      "saving": "Guardando...",
      "startRecording": "Iniciar Grabación",
      "stopRecording": "Detener Grabación",
      "pauseRecording": "Pausar Grabación",
      "resumeRecording": "Reanudar Grabación",
      "saveRecording": "Guardar Grabación",
      "discardRecording": "Descartar Grabación",
      "playback": "Reproducir"
    },
    "audio": {
      "listenTo": "Escuchar grabación:",
      "yourRecording": "Tu Grabación de Historia"
    },
    "tips": {
      "title": "Consejos de Grabación",
      "quietEnvironment": "Encuentra un ambiente tranquilo para la mejor calidad de audio",
      "speakClearly": "Habla claramente y a un ritmo cómodo",
      "stayClose": "Mantente cerca del micrófono",
      "testFirst": "Prueba tu audio antes de comenzar",
      "realtime": "💡 Usando reconocimiento de voz en tiempo real",
      "traditional": "💡 Grabación en progreso, la transcripción se procesará después de completar"
    },
    "ai": {
      "processing": "La IA está procesando tu historia...",
      "progress": "Progreso del Procesamiento",
      "working": "Nuestra IA está trabajando en tu historia:",
      "transcribing": "Transcribiendo tu audio",
      "generatingTitle": "Generando un título significativo",
      "creatingSummary": "Creando un resumen",
      "preparingQuestions": "Preparando preguntas de seguimiento",
      "generatedContent": "Contenido Generado por IA",
      "confidence": "confianza",
      "demoMode": "Modo Demo",
      "generatedTitle": "Título Generado:",
      "storySummary": "Resumen de la Historia:",
      "transcriptPreview": "Vista Previa de la Transcripción:",
      "followUpQuestions": "Preguntas de Seguimiento Sugeridas:",
      "moreQuestions": "más preguntas disponibles"
    },
    "errors": {
      "missingData": "Faltan datos requeridos para el envío de la historia.",
      "saveFailed": "Error al guardar la historia. Por favor, inténtalo de nuevo.",
      "empty": "La grabación está vacía, por favor inténtalo de nuevo"
    },
    "success": {
      "recorded": "Grabación completada",
      "paused": "Grabación pausada",
      "resumed": "Grabación reanudada",
      "saved": "¡Historia guardada exitosamente!",
      "answerRecorded": "¡Respuesta grabada exitosamente!"
    },
    "messages": {
      "processingAudio": "Procesando archivo de audio...",
      "audioProcessed": "Audio procesado exitosamente"
    },
    "optimization": {
      "title": "Optimización de Grabación",
      "enableOptimization": "Habilitar Optimización",
      "disableOptimization": "Deshabilitar Optimización"
    }
  },
  'fr': {
    "title": "Enregistrez Votre Histoire",
    "subtitle": "Partagez vos souvenirs avec des conseils alimentés par l'IA",
    "prompt": "Invite",
    "networkStatus": {
      "good": "Bonne Connexion",
      "poor": "Connexion Lente",
      "offline": "Mode Hors Ligne"
    },
    "status": {
      "ready": "Prêt à Enregistrer",
      "recording": "Enregistrement...",
      "paused": "Enregistrement en Pause",
      "completed": "Enregistrement Terminé",
      "recordingComplete": "Enregistrement Complet",
      "processing": "Traitement...",
      "uploading": "Téléchargement..."
    },
    "actions": {
      "start": "Démarrer l'Enregistrement",
      "pause": "Pause",
      "stop": "Arrêter",
      "continue": "Continuer",
      "complete": "Terminer l'Enregistrement",
      "reRecord": "Réenregistrer",
      "save": "Sauvegarder l'Histoire",
      "startOver": "Recommencer",
      "saving": "Sauvegarde...",
      "startRecording": "Démarrer l'Enregistrement",
      "stopRecording": "Arrêter l'Enregistrement",
      "pauseRecording": "Mettre en Pause l'Enregistrement",
      "resumeRecording": "Reprendre l'Enregistrement",
      "saveRecording": "Sauvegarder l'Enregistrement",
      "discardRecording": "Abandonner l'Enregistrement",
      "playback": "Lecture"
    },
    "audio": {
      "listenTo": "Écouter l'enregistrement :",
      "yourRecording": "Votre Enregistrement d'Histoire"
    },
    "tips": {
      "title": "Conseils d'Enregistrement",
      "quietEnvironment": "Trouvez un environnement calme pour la meilleure qualité audio",
      "speakClearly": "Parlez clairement et à un rythme confortable",
      "stayClose": "Restez près du microphone",
      "testFirst": "Testez votre audio avant de commencer",
      "realtime": "💡 Utilisation de la reconnaissance vocale en temps réel",
      "traditional": "💡 Enregistrement en cours, la transcription sera traitée après l'achèvement"
    },
    "ai": {
      "processing": "L'IA traite votre histoire...",
      "progress": "Progression du Traitement",
      "working": "Notre IA travaille sur votre histoire :",
      "transcribing": "Transcription de votre audio",
      "generatingTitle": "Génération d'un titre significatif",
      "creatingSummary": "Création d'un résumé",
      "preparingQuestions": "Préparation de questions de suivi",
      "generatedContent": "Contenu Généré par l'IA",
      "confidence": "confiance",
      "demoMode": "Mode Démo",
      "generatedTitle": "Titre Généré :",
      "storySummary": "Résumé de l'Histoire :",
      "transcriptPreview": "Aperçu de la Transcription :",
      "followUpQuestions": "Questions de Suivi Suggérées :",
      "moreQuestions": "plus de questions disponibles"
    },
    "errors": {
      "missingData": "Données requises manquantes pour la soumission de l'histoire.",
      "saveFailed": "Échec de la sauvegarde de l'histoire. Veuillez réessayer.",
      "empty": "L'enregistrement est vide, veuillez réessayer"
    },
    "success": {
      "recorded": "Enregistrement terminé",
      "paused": "Enregistrement en pause",
      "resumed": "Enregistrement repris",
      "saved": "Histoire sauvegardée avec succès !",
      "answerRecorded": "Réponse enregistrée avec succès !"
    },
    "messages": {
      "processingAudio": "Traitement du fichier audio...",
      "audioProcessed": "Audio traité avec succès"
    },
    "optimization": {
      "title": "Optimisation de l'Enregistrement",
      "enableOptimization": "Activer l'Optimisation",
      "disableOptimization": "Désactiver l'Optimisation"
    }
  },
  'ja': {
    "title": "あなたの物語を記録",
    "subtitle": "AI搭載ガイダンスで思い出を共有",
    "prompt": "プロンプト",
    "networkStatus": {
      "good": "良好な接続",
      "poor": "低速接続",
      "offline": "オフラインモード"
    },
    "status": {
      "ready": "録音準備完了",
      "recording": "録音中...",
      "paused": "録音一時停止",
      "completed": "録音完了",
      "recordingComplete": "録音完了",
      "processing": "処理中...",
      "uploading": "アップロード中..."
    },
    "actions": {
      "start": "録音開始",
      "pause": "一時停止",
      "stop": "停止",
      "continue": "続ける",
      "complete": "録音を完了",
      "reRecord": "再録音",
      "save": "ストーリーを保存",
      "startOver": "最初からやり直す",
      "saving": "保存中...",
      "startRecording": "録音開始",
      "stopRecording": "録音停止",
      "pauseRecording": "録音一時停止",
      "resumeRecording": "録音再開",
      "saveRecording": "録音を保存",
      "discardRecording": "録音を破棄",
      "playback": "再生"
    },
    "audio": {
      "listenTo": "録音を聞く：",
      "yourRecording": "あなたのストーリー録音"
    },
    "tips": {
      "title": "録音のヒント",
      "quietEnvironment": "最高の音質のために静かな環境を見つけてください",
      "speakClearly": "はっきりと快適なペースで話してください",
      "stayClose": "マイクの近くにいてください",
      "testFirst": "開始前にオーディオをテストしてください",
      "realtime": "💡 リアルタイム音声認識を使用",
      "traditional": "💡 録音中、文字起こしは完了後に処理されます"
    },
    "ai": {
      "processing": "AIがあなたの物語を処理しています...",
      "progress": "処理の進行状況",
      "working": "AIがあなたの物語に取り組んでいます：",
      "transcribing": "オーディオを文字起こし中",
      "generatingTitle": "意味のあるタイトルを生成中",
      "creatingSummary": "要約を作成中",
      "preparingQuestions": "フォローアップ質問を準備中",
      "generatedContent": "AI生成コンテンツ",
      "confidence": "信頼度",
      "demoMode": "デモモード",
      "generatedTitle": "生成されたタイトル：",
      "storySummary": "ストーリーの要約：",
      "transcriptPreview": "トランスクリプトプレビュー：",
      "followUpQuestions": "提案されたフォローアップ質問：",
      "moreQuestions": "さらに質問があります"
    },
    "errors": {
      "missingData": "ストーリー送信に必要なデータがありません。",
      "saveFailed": "ストーリーの保存に失敗しました。もう一度お試しください。",
      "empty": "録音が空です。もう一度お試しください"
    },
    "success": {
      "recorded": "録音完了",
      "paused": "録音一時停止",
      "resumed": "録音再開",
      "saved": "ストーリーが正常に保存されました！",
      "answerRecorded": "回答が正常に録音されました！"
    },
    "messages": {
      "processingAudio": "オーディオファイルを処理中...",
      "audioProcessed": "オーディオが正常に処理されました"
    },
    "optimization": {
      "title": "録音の最適化",
      "enableOptimization": "最適化を有効にする",
      "disableOptimization": "最適化を無効にする"
    }
  },
  'ko': {
    "title": "당신의 이야기를 기록하세요",
    "subtitle": "AI 기반 가이드로 추억을 공유하세요",
    "prompt": "프롬프트",
    "networkStatus": {
      "good": "양호한 연결",
      "poor": "느린 연결",
      "offline": "오프라인 모드"
    },
    "status": {
      "ready": "녹음 준비 완료",
      "recording": "녹음 중...",
      "paused": "녹음 일시 중지됨",
      "completed": "녹음 완료됨",
      "recordingComplete": "녹음 완료",
      "processing": "처리 중...",
      "uploading": "업로드 중..."
    },
    "actions": {
      "start": "녹음 시작",
      "pause": "일시 중지",
      "stop": "중지",
      "continue": "계속",
      "complete": "녹음 완료",
      "reRecord": "다시 녹음",
      "save": "스토리 저장",
      "startOver": "처음부터 다시 시작",
      "saving": "저장 중...",
      "startRecording": "녹음 시작",
      "stopRecording": "녹음 중지",
      "pauseRecording": "녹음 일시 중지",
      "resumeRecording": "녹음 재개",
      "saveRecording": "녹음 저장",
      "discardRecording": "녹음 삭제",
      "playback": "재생"
    },
    "audio": {
      "listenTo": "녹음 듣기:",
      "yourRecording": "당신의 스토리 녹음"
    },
    "tips": {
      "title": "녹음 팁",
      "quietEnvironment": "최상의 오디오 품질을 위해 조용한 환경을 찾으세요",
      "speakClearly": "명확하고 편안한 속도로 말하세요",
      "stayClose": "마이크 가까이에 있으세요",
      "testFirst": "시작하기 전에 오디오를 테스트하세요",
      "realtime": "💡 실시간 음성 인식 사용",
      "traditional": "💡 녹음 진행 중, 전사는 완료 후 처리됩니다"
    },
    "ai": {
      "processing": "AI가 당신의 이야기를 처리하고 있습니다...",
      "progress": "처리 진행 상황",
      "working": "AI가 당신의 이야기를 작업하고 있습니다:",
      "transcribing": "오디오 전사 중",
      "generatingTitle": "의미 있는 제목 생성 중",
      "creatingSummary": "요약 작성 중",
      "preparingQuestions": "후속 질문 준비 중",
      "generatedContent": "AI 생성 콘텐츠",
      "confidence": "신뢰도",
      "demoMode": "데모 모드",
      "generatedTitle": "생성된 제목:",
      "storySummary": "스토리 요약:",
      "transcriptPreview": "전사 미리보기:",
      "followUpQuestions": "제안된 후속 질문:",
      "moreQuestions": "더 많은 질문 사용 가능"
    },
    "errors": {
      "missingData": "스토리 제출에 필요한 데이터가 누락되었습니다.",
      "saveFailed": "스토리 저장에 실패했습니다. 다시 시도하세요.",
      "empty": "녹음이 비어 있습니다. 다시 시도하세요"
    },
    "success": {
      "recorded": "녹음 완료",
      "paused": "녹음 일시 중지됨",
      "resumed": "녹음 재개됨",
      "saved": "스토리가 성공적으로 저장되었습니다!",
      "answerRecorded": "답변이 성공적으로 녹음되었습니다!"
    },
    "messages": {
      "processingAudio": "오디오 파일 처리 중...",
      "audioProcessed": "오디오가 성공적으로 처리되었습니다"
    },
    "optimization": {
      "title": "녹음 최적화",
      "enableOptimization": "최적화 활성화",
      "disableOptimization": "최적화 비활성화"
    }
  },
  'pt': {
    "title": "Grave Sua História",
    "subtitle": "Compartilhe suas memórias com orientação alimentada por IA",
    "prompt": "Prompt",
    "networkStatus": {
      "good": "Boa Conexão",
      "poor": "Conexão Lenta",
      "offline": "Modo Offline"
    },
    "status": {
      "ready": "Pronto para Gravar",
      "recording": "Gravando...",
      "paused": "Gravação Pausada",
      "completed": "Gravação Concluída",
      "recordingComplete": "Gravação Completa",
      "processing": "Processando...",
      "uploading": "Enviando..."
    },
    "actions": {
      "start": "Iniciar Gravação",
      "pause": "Pausar",
      "stop": "Parar",
      "continue": "Continuar",
      "complete": "Concluir Gravação",
      "reRecord": "Regravar",
      "save": "Salvar História",
      "startOver": "Recomeçar",
      "saving": "Salvando...",
      "startRecording": "Iniciar Gravação",
      "stopRecording": "Parar Gravação",
      "pauseRecording": "Pausar Gravação",
      "resumeRecording": "Retomar Gravação",
      "saveRecording": "Salvar Gravação",
      "discardRecording": "Descartar Gravação",
      "playback": "Reproduzir"
    },
    "audio": {
      "listenTo": "Ouvir gravação:",
      "yourRecording": "Sua Gravação de História"
    },
    "tips": {
      "title": "Dicas de Gravação",
      "quietEnvironment": "Encontre um ambiente tranquilo para a melhor qualidade de áudio",
      "speakClearly": "Fale claramente e em um ritmo confortável",
      "stayClose": "Fique perto do microfone",
      "testFirst": "Teste seu áudio antes de começar",
      "realtime": "💡 Usando reconhecimento de fala em tempo real",
      "traditional": "💡 Gravação em andamento, a transcrição será processada após a conclusão"
    },
    "ai": {
      "processing": "A IA está processando sua história...",
      "progress": "Progresso do Processamento",
      "working": "Nossa IA está trabalhando em sua história:",
      "transcribing": "Transcrevendo seu áudio",
      "generatingTitle": "Gerando um título significativo",
      "creatingSummary": "Criando um resumo",
      "preparingQuestions": "Preparando perguntas de acompanhamento",
      "generatedContent": "Conteúdo Gerado por IA",
      "confidence": "confiança",
      "demoMode": "Modo Demo",
      "generatedTitle": "Título Gerado:",
      "storySummary": "Resumo da História:",
      "transcriptPreview": "Visualização da Transcrição:",
      "followUpQuestions": "Perguntas de Acompanhamento Sugeridas:",
      "moreQuestions": "mais perguntas disponíveis"
    },
    "errors": {
      "missingData": "Dados necessários ausentes para envio da história.",
      "saveFailed": "Falha ao salvar a história. Por favor, tente novamente.",
      "empty": "A gravação está vazia, por favor tente novamente"
    },
    "success": {
      "recorded": "Gravação concluída",
      "paused": "Gravação pausada",
      "resumed": "Gravação retomada",
      "saved": "História salva com sucesso!",
      "answerRecorded": "Resposta gravada com sucesso!"
    },
    "messages": {
      "processingAudio": "Processando arquivo de áudio...",
      "audioProcessed": "Áudio processado com sucesso"
    },
    "optimization": {
      "title": "Otimização de Gravação",
      "enableOptimization": "Ativar Otimização",
      "disableOptimization": "Desativar Otimização"
    }
  },
  'zh-TW': {
    "title": "記錄您的故事",
    "subtitle": "透過AI驅動的指導分享您的回憶",
    "prompt": "提示",
    "networkStatus": {
      "good": "良好連接",
      "poor": "緩慢連接",
      "offline": "離線模式"
    },
    "status": {
      "ready": "準備錄製",
      "recording": "錄製中...",
      "paused": "錄製已暫停",
      "completed": "錄製完成",
      "recordingComplete": "錄製完成",
      "processing": "處理中...",
      "uploading": "上傳中..."
    },
    "actions": {
      "start": "開始錄製",
      "pause": "暫停",
      "stop": "停止",
      "continue": "繼續",
      "complete": "完成錄製",
      "reRecord": "重新錄製",
      "save": "保存故事",
      "startOver": "重新開始",
      "saving": "保存中...",
      "startRecording": "開始錄製",
      "stopRecording": "停止錄製",
      "pauseRecording": "暫停錄製",
      "resumeRecording": "恢復錄製",
      "saveRecording": "保存錄製",
      "discardRecording": "丟棄錄製",
      "playback": "播放"
    },
    "audio": {
      "listenTo": "聆聽錄製：",
      "yourRecording": "您的故事錄製"
    },
    "tips": {
      "title": "錄製提示",
      "quietEnvironment": "尋找安靜的環境以獲得最佳音質",
      "speakClearly": "清晰地以舒適的速度說話",
      "stayClose": "靠近麥克風",
      "testFirst": "開始前測試您的音頻",
      "realtime": "💡 使用實時語音識別",
      "traditional": "💡 錄製進行中，轉錄將在完成後處理"
    },
    "ai": {
      "processing": "AI正在處理您的故事...",
      "progress": "處理進度",
      "working": "我們的AI正在處理您的故事：",
      "transcribing": "轉錄您的音頻",
      "generatingTitle": "生成有意義的標題",
      "creatingSummary": "創建摘要",
      "preparingQuestions": "準備後續問題",
      "generatedContent": "AI生成的內容",
      "confidence": "信心",
      "demoMode": "演示模式",
      "generatedTitle": "生成的標題：",
      "storySummary": "故事摘要：",
      "transcriptPreview": "轉錄預覽：",
      "followUpQuestions": "建議的後續問題：",
      "moreQuestions": "更多問題可用"
    },
    "errors": {
      "missingData": "故事提交缺少必需數據。",
      "saveFailed": "保存故事失敗。請重試。",
      "empty": "錄製為空，請重試"
    },
    "success": {
      "recorded": "錄製完成",
      "paused": "錄製已暫停",
      "resumed": "錄製已恢復",
      "saved": "故事保存成功！",
      "answerRecorded": "答案錄製成功！"
    },
    "messages": {
      "processingAudio": "處理音頻文件...",
      "audioProcessed": "音頻處理成功"
    },
    "optimization": {
      "title": "錄製優化",
      "enableOptimization": "啟用優化",
      "disableOptimization": "禁用優化"
    }
  }
};

function applyTranslations(lang, file, translations) {
  const filePath = path.join(baseDir, lang, file);
  fs.writeFileSync(filePath, JSON.stringify(translations, null, 2) + '\n');
  console.log(`✓ Updated ${lang}/${file}`);
}

console.log('Applying recording.json translations...\n');
for (const [lang, trans] of Object.entries(recordingTranslations)) {
  applyTranslations(lang, 'recording.json', trans);
}

console.log('\nAll recording.json translations completed!');
