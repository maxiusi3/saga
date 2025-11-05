const fs = require('fs');
const path = require('path');

// Manual translations for help.json
const helpTranslations = {
  'zh-CN': {
    "title": "帮助中心",
    "subtitle": "查找常见问题的答案并获取支持",
    "searchPlaceholder": "搜索帮助...",
    "quickActions": {
      "videoTutorials": {
        "title": "视频教程",
        "description": "分步指南帮助您入门"
      },
      "liveChat": {
        "title": "在线客服",
        "description": "从我们的支持团队获得即时帮助"
      },
      "emailSupport": {
        "title": "邮件支持",
        "description": "给我们发送消息，我们将在24小时内回复"
      }
    },
    "categories": {
      "all": "所有主题",
      "gettingStarted": "入门指南",
      "recording": "录制故事",
      "sharing": "分享与协作",
      "technical": "技术问题",
      "billing": "账单与定价"
    },
    "faqTitle": "常见问题",
    "noResults": "未找到匹配您搜索的问题。",
    "contact": {
      "title": "仍需要帮助？",
      "description": "我们的支持团队随时为您保存家族珍贵故事提供帮助。",
      "startChat": "开始在线聊天",
      "emailUs": "邮件支持"
    },
    "faqs": {
      "createProject": {
        "question": "如何创建我的第一个家族故事项目？",
        "answer": "要创建您的第一个项目，请从仪表板点击"创建新传奇"。您需要先购买传奇套餐，其中包含您开始所需的一切。购买后，您可以设置项目并邀请讲述者。"
      },
      "inviteMembers": {
        "question": "如何邀请家庭成员参与？",
        "answer": "从项目设置中，您可以邀请讲述者和协调者。点击"邀请讲述者"或"邀请协调者"并输入他们的电子邮件地址。他们将收到加入项目的邀请链接。"
      },
      "recordStories": {
        "question": "录制故事的最佳方式是什么？",
        "answer": "找一个安静的空间，背景噪音最小。使用内置提示引导对话，不要担心完美的录音 - 真实性比完美更重要。您可以随时暂停和恢复录音。"
      },
      "transcription": {
        "question": "转录功能如何工作？",
        "answer": "所有音频录音都会使用先进的AI技术自动转录。转录通常在上传后几分钟内准备就绪。如果需要，您可以编辑转录以纠正任何错误。"
      },
      "exportStories": {
        "question": "我可以导出家族故事吗？",
        "answer": "可以！您可以从项目设置导出完整的故事档案。这包括所有音频文件、转录、照片和评论的可下载格式。"
      },
      "moreSeats": {
        "question": "如果我需要更多席位怎么办？",
        "answer": "您可以随时从资源管理页面购买额外席位。额外的项目凭证费用为15美元，协调者席位费用为10美元，讲述者席位费用为5美元。"
      },
      "helpElderly": {
        "question": "如何帮助年长的家庭成员使用应用？",
        "answer": "讲述者界面设计简单直观。考虑一起进行练习，记住家庭成员只需专注于录制 - 您作为协调者处理所有项目管理。"
      },
      "privacy": {
        "question": "我的家族故事是私密和安全的吗？",
        "answer": "是的，所有故事默认都是私密的，只有受邀的家庭成员才能访问。我们使用企业级安全和加密来保护您的珍贵回忆。"
      }
    }
  },
  'zh-TW': {
    "title": "幫助中心",
    "subtitle": "查找常見問題的答案並獲取支援",
    "searchPlaceholder": "搜尋幫助...",
    "quickActions": {
      "videoTutorials": {
        "title": "影片教學",
        "description": "分步指南幫助您入門"
      },
      "liveChat": {
        "title": "線上客服",
        "description": "從我們的支援團隊獲得即時幫助"
      },
      "emailSupport": {
        "title": "郵件支援",
        "description": "給我們發送訊息，我們將在24小時內回覆"
      }
    },
    "categories": {
      "all": "所有主題",
      "gettingStarted": "入門指南",
      "recording": "錄製故事",
      "sharing": "分享與協作",
      "technical": "技術問題",
      "billing": "帳單與定價"
    },
    "faqTitle": "常見問題",
    "noResults": "未找到符合您搜尋的問題。",
    "contact": {
      "title": "仍需要幫助？",
      "description": "我們的支援團隊隨時為您保存家族珍貴故事提供幫助。",
      "startChat": "開始線上聊天",
      "emailUs": "郵件支援"
    },
    "faqs": {
      "createProject": {
        "question": "如何建立我的第一個家族故事專案？",
        "answer": "要建立您的第一個專案，請從儀表板點擊「建立新傳奇」。您需要先購買傳奇套餐，其中包含您開始所需的一切。購買後，您可以設定專案並邀請講述者。"
      },
      "inviteMembers": {
        "question": "如何邀請家庭成員參與？",
        "answer": "從專案設定中，您可以邀請講述者和協調者。點擊「邀請講述者」或「邀請協調者」並輸入他們的電子郵件地址。他們將收到加入專案的邀請連結。"
      },
      "recordStories": {
        "question": "錄製故事的最佳方式是什麼？",
        "answer": "找一個安靜的空間，背景噪音最小。使用內建提示引導對話，不要擔心完美的錄音 - 真實性比完美更重要。您可以隨時暫停和恢復錄音。"
      },
      "transcription": {
        "question": "轉錄功能如何運作？",
        "answer": "所有音訊錄音都會使用先進的AI技術自動轉錄。轉錄通常在上傳後幾分鐘內準備就緒。如果需要，您可以編輯轉錄以糾正任何錯誤。"
      },
      "exportStories": {
        "question": "我可以匯出家族故事嗎？",
        "answer": "可以！您可以從專案設定匯出完整的故事檔案。這包括所有音訊檔案、轉錄、照片和評論的可下載格式。"
      },
      "moreSeats": {
        "question": "如果我需要更多席位怎麼辦？",
        "answer": "您可以隨時從資源管理頁面購買額外席位。額外的專案憑證費用為15美元，協調者席位費用為10美元，講述者席位費用為5美元。"
      },
      "helpElderly": {
        "question": "如何幫助年長的家庭成員使用應用程式？",
        "answer": "講述者介面設計簡單直觀。考慮一起進行練習，記住家庭成員只需專注於錄製 - 您作為協調者處理所有專案管理。"
      },
      "privacy": {
        "question": "我的家族故事是私密和安全的嗎？",
        "answer": "是的，所有故事預設都是私密的，只有受邀的家庭成員才能存取。我們使用企業級安全和加密來保護您的珍貴回憶。"
      }
    }
  },
  'ja': {
    "title": "ヘルプセンター",
    "subtitle": "よくある質問の回答を見つけてサポートを受ける",
    "searchPlaceholder": "ヘルプを検索...",
    "quickActions": {
      "videoTutorials": {
        "title": "ビデオチュートリアル",
        "description": "始めるためのステップバイステップガイド"
      },
      "liveChat": {
        "title": "ライブチャット",
        "description": "サポートチームから即座にヘルプを受ける"
      },
      "emailSupport": {
        "title": "メールサポート",
        "description": "メッセージを送信すると24時間以内に返信します"
      }
    },
    "categories": {
      "all": "すべてのトピック",
      "gettingStarted": "はじめに",
      "recording": "ストーリーの録音",
      "sharing": "共有とコラボレーション",
      "technical": "技術的な問題",
      "billing": "請求と価格"
    },
    "faqTitle": "よくある質問",
    "noResults": "検索に一致する質問が見つかりませんでした。",
    "contact": {
      "title": "まだヘルプが必要ですか？",
      "description": "サポートチームが家族の貴重なストーリーを保存するお手伝いをします。",
      "startChat": "ライブチャットを開始",
      "emailUs": "メールサポート"
    },
    "faqs": {
      "createProject": {
        "question": "最初の家族ストーリープロジェクトを作成するにはどうすればよいですか？",
        "answer": "最初のプロジェクトを作成するには、ダッシュボードから「新しいサーガを作成」をクリックします。まずサーガパッケージを購入する必要があります。これには開始に必要なすべてが含まれています。購入後、プロジェクトを設定してストーリーテラーを招待できます。"
      },
      "inviteMembers": {
        "question": "家族を参加させるにはどうすればよいですか？",
        "answer": "プロジェクト設定から、ストーリーテラーとファシリテーターを招待できます。「ストーリーテラーを招待」または「ファシリテーターを招待」をクリックして、メールアドレスを入力します。プロジェクトに参加するための招待リンクが送信されます。"
      },
      "recordStories": {
        "question": "ストーリーを録音する最良の方法は何ですか？",
        "answer": "背景ノイズが最小限の静かな場所を見つけてください。組み込みのプロンプトを使用して会話をガイドし、完璧な録音を心配する必要はありません - 真実性が完璧さよりも重要です。いつでも録音を一時停止して再開できます。"
      },
      "transcription": {
        "question": "文字起こし機能はどのように機能しますか？",
        "answer": "すべての音声録音は、高度なAI技術を使用して自動的に文字起こしされます。文字起こしは通常、アップロード後数分で準備が整います。必要に応じて、エラーを修正するために文字起こしを編集できます。"
      },
      "exportStories": {
        "question": "家族のストーリーをエクスポートできますか？",
        "answer": "はい！プロジェクト設定から完全なストーリーアーカイブをエクスポートできます。これには、すべての音声ファイル、文字起こし、写真、コメントがダウンロード可能な形式で含まれます。"
      },
      "moreSeats": {
        "question": "より多くのシートが必要な場合はどうすればよいですか？",
        "answer": "リソース管理ページからいつでも追加のシートを購入できます。追加のプロジェクトバウチャーは15ドル、ファシリテーターシートは10ドル、ストーリーテラーシートは5ドルです。"
      },
      "helpElderly": {
        "question": "高齢の家族がアプリを使用するのを手伝うにはどうすればよいですか？",
        "answer": "ストーリーテラーインターフェースはシンプルで直感的に設計されています。一緒に練習セッションを行うことを検討し、家族は録音に集中するだけでよいことを覚えておいてください - ファシリテーターとしてすべてのプロジェクト管理を処理します。"
      },
      "privacy": {
        "question": "家族のストーリーはプライベートで安全ですか？",
        "answer": "はい、すべてのストーリーはデフォルトでプライベートであり、招待された家族のみがアクセスできます。貴重な思い出を保護するために、エンタープライズグレードのセキュリティと暗号化を使用しています。"
      }
    }
  },
  'ko': {
    "title": "도움말 센터",
    "subtitle": "자주 묻는 질문에 대한 답변을 찾고 지원을 받으세요",
    "searchPlaceholder": "도움말 검색...",
    "quickActions": {
      "videoTutorials": {
        "title": "비디오 튜토리얼",
        "description": "시작하기 위한 단계별 가이드"
      },
      "liveChat": {
        "title": "실시간 채팅",
        "description": "지원 팀으로부터 즉각적인 도움 받기"
      },
      "emailSupport": {
        "title": "이메일 지원",
        "description": "메시지를 보내주시면 24시간 이내에 답변드립니다"
      }
    },
    "categories": {
      "all": "모든 주제",
      "gettingStarted": "시작하기",
      "recording": "스토리 녹음",
      "sharing": "공유 및 협업",
      "technical": "기술 문제",
      "billing": "청구 및 가격"
    },
    "faqTitle": "자주 묻는 질문",
    "noResults": "검색과 일치하는 질문을 찾을 수 없습니다.",
    "contact": {
      "title": "여전히 도움이 필요하신가요?",
      "description": "지원 팀이 가족의 소중한 이야기를 보존하는 데 도움을 드립니다.",
      "startChat": "실시간 채팅 시작",
      "emailUs": "이메일 지원"
    },
    "faqs": {
      "createProject": {
        "question": "첫 번째 가족 이야기 프로젝트를 만들려면 어떻게 해야 하나요?",
        "answer": "첫 번째 프로젝트를 만들려면 대시보드에서 '새 사가 만들기'를 클릭하세요. 먼저 사가 패키지를 구매해야 하며, 여기에는 시작하는 데 필요한 모든 것이 포함되어 있습니다. 구매 후 프로젝트를 설정하고 스토리텔러를 초대할 수 있습니다."
      },
      "inviteMembers": {
        "question": "가족 구성원을 참여시키려면 어떻게 해야 하나요?",
        "answer": "프로젝트 설정에서 스토리텔러와 진행자를 초대할 수 있습니다. '스토리텔러 초대' 또는 '진행자 초대'를 클릭하고 이메일 주소를 입력하세요. 프로젝트에 참여할 수 있는 초대 링크를 받게 됩니다."
      },
      "recordStories": {
        "question": "스토리를 녹음하는 가장 좋은 방법은 무엇인가요?",
        "answer": "배경 소음이 최소화된 조용한 공간을 찾으세요. 내장된 프롬프트를 사용하여 대화를 안내하고 완벽한 녹음에 대해 걱정하지 마세요 - 진정성이 완벽함보다 중요합니다. 언제든지 녹음을 일시 중지하고 재개할 수 있습니다."
      },
      "transcription": {
        "question": "전사 기능은 어떻게 작동하나요?",
        "answer": "모든 오디오 녹음은 고급 AI 기술을 사용하여 자동으로 전사됩니다. 전사는 일반적으로 업로드 후 몇 분 내에 준비됩니다. 필요한 경우 오류를 수정하기 위해 전사를 편집할 수 있습니다."
      },
      "exportStories": {
        "question": "가족 이야기를 내보낼 수 있나요?",
        "answer": "예! 프로젝트 설정에서 전체 스토리 아카이브를 내보낼 수 있습니다. 여기에는 모든 오디오 파일, 전사, 사진 및 댓글이 다운로드 가능한 형식으로 포함됩니다."
      },
      "moreSeats": {
        "question": "더 많은 좌석이 필요하면 어떻게 하나요?",
        "answer": "리소스 관리 페이지에서 언제든지 추가 좌석을 구매할 수 있습니다. 추가 프로젝트 바우처는 $15, 진행자 좌석은 $10, 스토리텔러 좌석은 $5입니다."
      },
      "helpElderly": {
        "question": "연로한 가족 구성원이 앱을 사용하도록 돕려면 어떻게 해야 하나요?",
        "answer": "스토리텔러 인터페이스는 간단하고 직관적으로 설계되었습니다. 함께 연습 세션을 하는 것을 고려하고, 가족 구성원은 녹음에만 집중하면 된다는 것을 기억하세요 - 진행자로서 모든 프로젝트 관리를 처리합니다."
      },
      "privacy": {
        "question": "가족 이야기는 비공개이고 안전한가요?",
        "answer": "예, 모든 스토리는 기본적으로 비공개이며 초대된 가족 구성원만 액세스할 수 있습니다. 소중한 추억을 보호하기 위해 엔터프라이즈급 보안 및 암호화를 사용합니다."
      }
    }
  }
};

// Create translation files
function createTranslations() {
  console.log('🚀 Creating help.json translations...\n');

  for (const [langCode, content] of Object.entries(helpTranslations)) {
    const targetPath = path.join(__dirname, `packages/web/public/locales/${langCode}/help.json`);
    
    // Ensure directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(targetPath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`✅ Created ${langCode}/help.json`);
  }

  console.log('\n✅ All help.json translations created successfully!');
}

createTranslations();
