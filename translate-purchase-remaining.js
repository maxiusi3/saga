const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

const purchaseTranslations = {
  'ja': {
    "hero": {
      "limitedOffer": "期間限定オファー",
      "title": "家族の物語を永遠に保存",
      "subtitle": "貴重な思い出と知恵を捉える永続的なデジタル伝記を作成します。",
      "startCapturing": "今日から家族のユニークな物語の記録を始めましょう"
    },
    "features": {
      "collaboration": {
        "title": "家族での協力",
        "description": "家族を招待して、一緒に物語や思い出を共有しましょう。"
      },
      "aiPrompts": {
        "title": "AI搭載プロンプト",
        "description": "意味のある思い出を引き出すのに役立つインテリジェントな質問。"
      },
      "secure": {
        "title": "安全でプライベート",
        "description": "家族の物語は暗号化され、安全に保存されます。"
      }
    },
    "pricing": {
      "title": "パッケージを選択",
      "subtitle": "美しい家族の伝記を作成するために必要なすべて。",
      "package": {
        "title": "ファミリーサガパッケージ",
        "subtitle": "AI搭載ストーリーテリングを備えた完全な家族伝記ソリューション",
        "price": "$209",
        "period": "一回払い",
        "features": {
          "unlimitedProjects": "無制限のプロジェクトを作成",
          "unlimitedMembers": "無制限の家族メンバーを招待",
          "aiPrompts": "AI搭載ストーリープロンプト",
          "transcription": "プロフェッショナルな文字起こし",
          "photoAudio": "写真と音声の統合",
          "cloudStorage": "安全なクラウドストレージ",
          "mobileWeb": "モバイルとWebアクセス",
          "oneYear": "1年間のインタラクティブサービス",
          "archival": "永続的なアーカイブモードアクセス"
        },
        "cta": "始める"
      }
    },
    "checkout": {
      "title": "購入を完了",
      "orderSummary": "注文概要",
      "packageName": "ファミリーサガパッケージ",
      "oneTime": "一回払い",
      "noRecurring": "継続料金なし",
      "total": "合計",
      "firstName": "名",
      "lastName": "姓",
      "email": "メールアドレス",
      "cardNumber": "カード番号",
      "expiry": "有効期限",
      "cvc": "CVC",
      "security": {
        "ssl": "SSL暗号化",
        "secure": "安全な支払い",
        "guarantee": "30日間保証"
      },
      "completePurchase": "購入を完了 - $209",
      "processing": "処理中...",
      "terms": "購入を完了することで、利用規約とプライバシーポリシーに同意したことになります。30日以内であればいつでもキャンセルして全額返金を受けることができます。"
    },
    "reviews": {
      "title": "家族の声",
      "rating": "1,200以上の家族から",
      "testimonials": {
        "sarah": {
          "name": "Sarah Johnson",
          "role": "家族史家",
          "quote": "Sagaは、手遅れになる前に祖母の物語を記録するのに役立ちました。AIプロンプトは、私たちが知らなかった思い出を引き出しました。"
        },
        "michael": {
          "name": "Michael Chen",
          "role": "プロジェクトファシリテーター",
          "quote": "文字起こしの品質は素晴らしく、家族協力機能により、誰もが簡単に貢献できました。"
        },
        "emma": {
          "name": "Emma Rodriguez",
          "role": "家族メンバー",
          "quote": "お金を払う価値があります。私たちは今、永遠に続く家族の歴史の美しいデジタルアーカイブを持っています。"
        }
      }
    },
    "faq": {
      "title": "よくある質問",
      "questions": {
        "afterYear": {
          "question": "最初の1年後はどうなりますか？",
          "answer": "最初の1年間のインタラクティブサービスの後、いつでもインタラクティブ機能を再アクティブ化できます。または、アーカイブモードですべてのストーリーにアクセス、表示、エクスポートできます。"
        },
        "members": {
          "question": "何人の家族メンバーが参加できますか？",
          "answer": "無制限の家族メンバーを招待して、ストーリーを表示およびコメントできます。パッケージには、複数のファシリテーターとストーリーテラーがコンテンツに積極的に貢献するための席が含まれています。"
        },
        "security": {
          "question": "家族のデータは安全ですか？",
          "answer": "はい、絶対に。エンタープライズグレードの暗号化と安全なストレージを使用しています。個人的な家族の物語は第三者と共有されることはなく、安全に保存されます。"
        }
      }
    }
  },
  'ko': {
    "hero": {
      "limitedOffer": "기간 한정 제안",
      "title": "가족 이야기를 영원히 보존하세요",
      "subtitle": "소중한 추억과 지혜를 담은 영구적인 디지털 전기를 만드세요.",
      "startCapturing": "오늘 가족의 독특한 이야기 기록을 시작하세요"
    },
    "features": {
      "collaboration": {
        "title": "가족 협업",
        "description": "가족 구성원을 초대하여 함께 이야기와 추억을 공유하세요."
      },
      "aiPrompts": {
        "title": "AI 기반 프롬프트",
        "description": "의미 있는 추억을 끌어내는 데 도움이 되는 지능형 질문."
      },
      "secure": {
        "title": "안전하고 비공개",
        "description": "가족 이야기는 암호화되어 안전하게 저장됩니다."
      }
    },
    "pricing": {
      "title": "패키지 선택",
      "subtitle": "아름다운 가족 전기를 만드는 데 필요한 모든 것.",
      "package": {
        "title": "패밀리 사가 패키지",
        "subtitle": "AI 기반 스토리텔링을 갖춘 완전한 가족 전기 솔루션",
        "price": "$209",
        "period": "일회성",
        "features": {
          "unlimitedProjects": "무제한 프로젝트 생성",
          "unlimitedMembers": "무제한 가족 구성원 초대",
          "aiPrompts": "AI 기반 스토리 프롬프트",
          "transcription": "전문 전사",
          "photoAudio": "사진 및 오디오 통합",
          "cloudStorage": "안전한 클라우드 스토리지",
          "mobileWeb": "모바일 및 웹 액세스",
          "oneYear": "1년 인터랙티브 서비스",
          "archival": "영구 아카이브 모드 액세스"
        },
        "cta": "시작하기"
      }
    },
    "checkout": {
      "title": "구매 완료",
      "orderSummary": "주문 요약",
      "packageName": "패밀리 사가 패키지",
      "oneTime": "일회성 결제",
      "noRecurring": "반복 요금 없음",
      "total": "합계",
      "firstName": "이름",
      "lastName": "성",
      "email": "이메일 주소",
      "cardNumber": "카드 번호",
      "expiry": "만료일",
      "cvc": "CVC",
      "security": {
        "ssl": "SSL 암호화",
        "secure": "안전한 결제",
        "guarantee": "30일 보증"
      },
      "completePurchase": "구매 완료 - $209",
      "processing": "처리 중...",
      "terms": "구매를 완료하면 서비스 약관 및 개인정보 보호정책에 동의하는 것입니다. 30일 이내에 언제든지 취소하고 전액 환불받을 수 있습니다."
    },
    "reviews": {
      "title": "가족들의 평가",
      "rating": "1,200개 이상의 가족으로부터",
      "testimonials": {
        "sarah": {
          "name": "Sarah Johnson",
          "role": "가족 역사가",
          "quote": "Saga는 너무 늦기 전에 할머니의 이야기를 기록하는 데 도움을 주었습니다. AI 프롬프트는 우리가 존재하는지 몰랐던 추억을 끌어냈습니다."
        },
        "michael": {
          "name": "Michael Chen",
          "role": "프로젝트 진행자",
          "quote": "전사 품질이 놀랍고 가족 협업 기능 덕분에 모두가 쉽게 기여할 수 있었습니다."
        },
        "emma": {
          "name": "Emma Rodriguez",
          "role": "가족 구성원",
          "quote": "모든 돈의 가치가 있습니다. 이제 우리는 영원히 지속될 가족 역사의 아름다운 디지털 아카이브를 가지고 있습니다."
        }
      }
    },
    "faq": {
      "title": "자주 묻는 질문",
      "questions": {
        "afterYear": {
          "question": "첫 해 이후에는 어떻게 되나요?",
          "answer": "첫 해의 인터랙티브 서비스 이후 언제든지 인터랙티브 기능을 다시 활성화하거나 아카이브 모드에서 모든 스토리에 액세스, 보기 및 내보내기를 계속할 수 있습니다."
        },
        "members": {
          "question": "몇 명의 가족 구성원이 참여할 수 있나요?",
          "answer": "무제한 가족 구성원을 초대하여 스토리를 보고 댓글을 달 수 있습니다. 패키지에는 여러 진행자와 이야기꾼이 콘텐츠에 적극적으로 기여할 수 있는 좌석이 포함되어 있습니다."
        },
        "security": {
          "question": "가족 데이터가 안전한가요?",
          "answer": "예, 절대적으로 안전합니다. 엔터프라이즈급 암호화 및 안전한 스토리지를 사용합니다. 개인 가족 이야기는 제3자와 공유되지 않으며 안전하게 저장됩니다."
        }
      }
    }
  },
  'pt': {
    "hero": {
      "limitedOffer": "Oferta por Tempo Limitado",
      "title": "Preserve as Histórias da Sua Família Para Sempre",
      "subtitle": "Crie biografias digitais duradouras que capturam memórias e sabedoria preciosas.",
      "startCapturing": "Comece a capturar a história única da sua família hoje"
    },
    "features": {
      "collaboration": {
        "title": "Colaboração Familiar",
        "description": "Convide membros da família para contribuir com histórias e memórias juntos."
      },
      "aiPrompts": {
        "title": "Prompts com IA",
        "description": "Perguntas inteligentes que ajudam a desbloquear memórias significativas."
      },
      "secure": {
        "title": "Seguro e Privado",
        "description": "As histórias da sua família são criptografadas e armazenadas com segurança."
      }
    },
    "pricing": {
      "title": "Escolha Seu Pacote",
      "subtitle": "Tudo o que você precisa para criar belas biografias familiares.",
      "package": {
        "title": "Pacote Saga Familiar",
        "subtitle": "Solução completa de biografia familiar com narrativa alimentada por IA",
        "price": "$209",
        "period": "pagamento único",
        "features": {
          "unlimitedProjects": "Crie projetos ilimitados",
          "unlimitedMembers": "Convide membros da família ilimitados",
          "aiPrompts": "Prompts de histórias com IA",
          "transcription": "Transcrição profissional",
          "photoAudio": "Integração de fotos e áudio",
          "cloudStorage": "Armazenamento seguro na nuvem",
          "mobileWeb": "Acesso móvel e web",
          "oneYear": "1 ano de serviço interativo",
          "archival": "Acesso permanente ao modo de arquivo"
        },
        "cta": "Começar"
      }
    },
    "checkout": {
      "title": "Complete Sua Compra",
      "orderSummary": "Resumo do Pedido",
      "packageName": "Pacote Saga Familiar",
      "oneTime": "Pagamento único",
      "noRecurring": "Sem taxas recorrentes",
      "total": "Total",
      "firstName": "Nome",
      "lastName": "Sobrenome",
      "email": "Endereço de E-mail",
      "cardNumber": "Número do Cartão",
      "expiry": "Data de Validade",
      "cvc": "CVC",
      "security": {
        "ssl": "Criptografado SSL",
        "secure": "Pagamento Seguro",
        "guarantee": "Garantia de 30 Dias"
      },
      "completePurchase": "Finalizar Compra - $209",
      "processing": "Processando...",
      "terms": "Ao finalizar sua compra, você concorda com nossos Termos de Serviço e Política de Privacidade. Você pode cancelar a qualquer momento dentro de 30 dias para obter um reembolso total."
    },
    "reviews": {
      "title": "O Que as Famílias Estão Dizendo",
      "rating": "de mais de 1.200 famílias",
      "testimonials": {
        "sarah": {
          "name": "Sarah Johnson",
          "role": "Historiadora Familiar",
          "quote": "Saga nos ajudou a capturar as histórias da minha avó antes que fosse tarde demais. Os prompts de IA trouxeram memórias que nunca soubemos que existiam."
        },
        "michael": {
          "name": "Michael Chen",
          "role": "Facilitador de Projeto",
          "quote": "A qualidade da transcrição é incrível, e os recursos de colaboração familiar facilitaram a contribuição de todos."
        },
        "emma": {
          "name": "Emma Rodriguez",
          "role": "Membro da Família",
          "quote": "Vale cada centavo. Agora temos um belo arquivo digital da nossa história familiar que durará para sempre."
        }
      }
    },
    "faq": {
      "title": "Perguntas Frequentes",
      "questions": {
        "afterYear": {
          "question": "O que acontece após o primeiro ano?",
          "answer": "Após seu primeiro ano de serviço interativo, você pode reativar os recursos interativos a qualquer momento, ou ainda pode acessar, visualizar e exportar todas as suas histórias no modo de arquivo."
        },
        "members": {
          "question": "Quantos membros da família podem participar?",
          "answer": "Você pode convidar membros da família ilimitados para visualizar e comentar histórias. O pacote inclui assentos para vários facilitadores e contadores de histórias para contribuir ativamente com conteúdo."
        },
        "security": {
          "question": "Os dados da minha família estão seguros?",
          "answer": "Sim, absolutamente. Usamos criptografia de nível empresarial e armazenamento seguro. As histórias pessoais da sua família nunca são compartilhadas com terceiros e são armazenadas com segurança."
        }
      }
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

console.log('Applying remaining purchase-page.json translations...\n');
for (const [lang, trans] of Object.entries(purchaseTranslations)) {
  applyTranslations(lang, 'purchase-page.json', trans);
}

console.log('\nAll purchase-page.json translations completed!');
