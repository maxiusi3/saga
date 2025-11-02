const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

// Purchase Page Translations
const purchasePageTranslations = {
  'es': {
    "hero": {
      "limitedOffer": "Oferta por Tiempo Limitado",
      "title": "Preserva las Historias de Tu Familia Para Siempre",
      "subtitle": "Crea biografías digitales duraderas que capturen recuerdos y sabiduría preciosos.",
      "startCapturing": "Comienza a capturar la historia única de tu familia hoy"
    },
    "features": {
      "collaboration": {
        "title": "Colaboración Familiar",
        "description": "Invita a miembros de la familia a contribuir historias y recuerdos juntos."
      },
      "aiPrompts": {
        "title": "Indicaciones con IA",
        "description": "Preguntas inteligentes que ayudan a desbloquear recuerdos significativos."
      },
      "secure": {
        "title": "Seguro y Privado",
        "description": "Las historias de tu familia están encriptadas y almacenadas de forma segura."
      }
    },
    "pricing": {
      "title": "Elige Tu Paquete",
      "subtitle": "Todo lo que necesitas para crear hermosas biografías familiares.",
      "package": {
        "title": "Paquete Saga Familiar",
        "subtitle": "Solución completa de biografía familiar con narración impulsada por IA",
        "price": "$209",
        "period": "pago único",
        "features": {
          "unlimitedProjects": "Crea proyectos ilimitados",
          "unlimitedMembers": "Invita a miembros familiares ilimitados",
          "aiPrompts": "Indicaciones de historias con IA",
          "transcription": "Transcripción profesional",
          "photoAudio": "Integración de fotos y audio",
          "cloudStorage": "Almacenamiento seguro en la nube",
          "mobileWeb": "Acceso móvil y web",
          "oneYear": "1 año de servicio interactivo",
          "archival": "Acceso permanente al modo de archivo"
        },
        "cta": "Comenzar"
      }
    },
    "checkout": {
      "title": "Completa Tu Compra",
      "orderSummary": "Resumen del Pedido",
      "packageName": "Paquete Saga Familiar",
      "oneTime": "Pago único",
      "noRecurring": "Sin tarifas recurrentes",
      "total": "Total",
      "firstName": "Nombre",
      "lastName": "Apellido",
      "email": "Correo Electrónico",
      "cardNumber": "Número de Tarjeta",
      "expiry": "Fecha de Vencimiento",
      "cvc": "CVC",
      "security": {
        "ssl": "Encriptado SSL",
        "secure": "Pago Seguro",
        "guarantee": "Garantía de 30 Días"
      },
      "completePurchase": "Completar Compra - $209",
      "processing": "Procesando...",
      "terms": "Al completar tu compra, aceptas nuestros Términos de Servicio y Política de Privacidad. Puedes cancelar en cualquier momento dentro de los 30 días para obtener un reembolso completo."
    },
    "reviews": {
      "title": "Lo Que Dicen las Familias",
      "rating": "de más de 1,200 familias",
      "testimonials": {
        "sarah": {
          "name": "Sarah Johnson",
          "role": "Historiadora Familiar",
          "quote": "Saga nos ayudó a capturar las historias de mi abuela antes de que fuera demasiado tarde. Las indicaciones de IA sacaron recuerdos que nunca supimos que existían."
        },
        "michael": {
          "name": "Michael Chen",
          "role": "Facilitador de Proyecto",
          "quote": "La calidad de la transcripción es increíble, y las funciones de colaboración familiar facilitaron que todos contribuyeran."
        },
        "emma": {
          "name": "Emma Rodriguez",
          "role": "Miembro de la Familia",
          "quote": "Vale cada centavo. Ahora tenemos un hermoso archivo digital de nuestra historia familiar que durará para siempre."
        }
      }
    },
    "faq": {
      "title": "Preguntas Frecuentes",
      "questions": {
        "afterYear": {
          "question": "¿Qué sucede después del primer año?",
          "answer": "Después de tu primer año de servicio interactivo, puedes reactivar las funciones interactivas en cualquier momento, o aún puedes acceder, ver y exportar todas tus historias en modo de archivo."
        },
        "members": {
          "question": "¿Cuántos miembros de la familia pueden participar?",
          "answer": "Puedes invitar a miembros familiares ilimitados para ver y comentar historias. El paquete incluye asientos para múltiples facilitadores y narradores para contribuir activamente con contenido."
        },
        "security": {
          "question": "¿Están seguros los datos de mi familia?",
          "answer": "Sí, absolutamente. Utilizamos encriptación de nivel empresarial y almacenamiento seguro. Las historias personales de tu familia nunca se comparten con terceros y se almacenan de forma segura."
        }
      }
    }
  },
  'fr': {
    "hero": {
      "limitedOffer": "Offre à Durée Limitée",
      "title": "Préservez les Histoires de Votre Famille Pour Toujours",
      "subtitle": "Créez des biographies numériques durables qui capturent des souvenirs et une sagesse précieux.",
      "startCapturing": "Commencez à capturer l'histoire unique de votre famille aujourd'hui"
    },
    "features": {
      "collaboration": {
        "title": "Collaboration Familiale",
        "description": "Invitez les membres de la famille à contribuer des histoires et des souvenirs ensemble."
      },
      "aiPrompts": {
        "title": "Invites Alimentées par l'IA",
        "description": "Questions intelligentes qui aident à débloquer des souvenirs significatifs."
      },
      "secure": {
        "title": "Sécurisé et Privé",
        "description": "Les histoires de votre famille sont cryptées et stockées en toute sécurité."
      }
    },
    "pricing": {
      "title": "Choisissez Votre Forfait",
      "subtitle": "Tout ce dont vous avez besoin pour créer de belles biographies familiales.",
      "package": {
        "title": "Forfait Saga Familiale",
        "subtitle": "Solution complète de biographie familiale avec narration alimentée par l'IA",
        "price": "$209",
        "period": "paiement unique",
        "features": {
          "unlimitedProjects": "Créez des projets illimités",
          "unlimitedMembers": "Invitez des membres de famille illimités",
          "aiPrompts": "Invites d'histoires alimentées par l'IA",
          "transcription": "Transcription professionnelle",
          "photoAudio": "Intégration photo et audio",
          "cloudStorage": "Stockage cloud sécurisé",
          "mobileWeb": "Accès mobile et web",
          "oneYear": "1 an de service interactif",
          "archival": "Accès permanent au mode d'archivage"
        },
        "cta": "Commencer"
      }
    },
    "checkout": {
      "title": "Complétez Votre Achat",
      "orderSummary": "Résumé de la Commande",
      "packageName": "Forfait Saga Familiale",
      "oneTime": "Paiement unique",
      "noRecurring": "Pas de frais récurrents",
      "total": "Total",
      "firstName": "Prénom",
      "lastName": "Nom",
      "email": "Adresse E-mail",
      "cardNumber": "Numéro de Carte",
      "expiry": "Date d'Expiration",
      "cvc": "CVC",
      "security": {
        "ssl": "Crypté SSL",
        "secure": "Paiement Sécurisé",
        "guarantee": "Garantie de 30 Jours"
      },
      "completePurchase": "Finaliser l'Achat - $209",
      "processing": "Traitement...",
      "terms": "En finalisant votre achat, vous acceptez nos Conditions de Service et notre Politique de Confidentialité. Vous pouvez annuler à tout moment dans les 30 jours pour un remboursement complet."
    },
    "reviews": {
      "title": "Ce Que Disent les Familles",
      "rating": "de plus de 1 200 familles",
      "testimonials": {
        "sarah": {
          "name": "Sarah Johnson",
          "role": "Historienne Familiale",
          "quote": "Saga nous a aidés à capturer les histoires de ma grand-mère avant qu'il ne soit trop tard. Les invites IA ont fait ressortir des souvenirs que nous ne savions pas exister."
        },
        "michael": {
          "name": "Michael Chen",
          "role": "Facilitateur de Projet",
          "quote": "La qualité de la transcription est incroyable, et les fonctionnalités de collaboration familiale ont facilité la contribution de tous."
        },
        "emma": {
          "name": "Emma Rodriguez",
          "role": "Membre de la Famille",
          "quote": "Ça vaut chaque centime. Nous avons maintenant une belle archive numérique de notre histoire familiale qui durera éternellement."
        }
      }
    },
    "faq": {
      "title": "Questions Fréquemment Posées",
      "questions": {
        "afterYear": {
          "question": "Que se passe-t-il après la première année ?",
          "answer": "Après votre première année de service interactif, vous pouvez réactiver les fonctionnalités interactives à tout moment, ou vous pouvez toujours accéder, visualiser et exporter toutes vos histoires en mode d'archivage."
        },
        "members": {
          "question": "Combien de membres de la famille peuvent participer ?",
          "answer": "Vous pouvez inviter un nombre illimité de membres de la famille pour voir et commenter les histoires. Le forfait comprend des sièges pour plusieurs facilitateurs et conteurs pour contribuer activement au contenu."
        },
        "security": {
          "question": "Les données de ma famille sont-elles sécurisées ?",
          "answer": "Oui, absolument. Nous utilisons un cryptage de niveau entreprise et un stockage sécurisé. Les histoires personnelles de votre famille ne sont jamais partagées avec des tiers et sont stockées en toute sécurité."
        }
      }
    }
  }
};

// Apply translations
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

console.log('Applying purchase-page.json translations...\n');
for (const [lang, trans] of Object.entries(purchasePageTranslations)) {
  applyTranslations(lang, 'purchase-page.json', trans);
}

console.log('\nPurchase page translations completed!');
console.log('Run this script again for other files or continue with recording.json and project-settings.json');
