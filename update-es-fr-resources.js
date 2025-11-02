const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

const resourcesTranslations = {
  'es': {
    "title": "Mis Recursos",
    "subtitle": "Gestiona tus asientos disponibles y compra recursos adicionales",
    "buyMoreSeats": "Comprar Más Asientos",
    "available": "Disponible",
    "usage": "Uso",
    "usageStats": "{used} de {total} usados",
    "buyMore": "Comprar Más (${price} cada uno)",
    "recentActivity": "Actividad Reciente",
    "purchaseAdditional": "Comprar Asientos Adicionales",
    "packagePromo": "¿Necesitas múltiples asientos? Obtén mejor valor con nuestro paquete completo.",
    "viewPackage": "Ver Paquete Saga ($29)",
    "types": {
      "project": {
        "title": "Vales de Proyecto",
        "description": "Crear nuevos proyectos de historias familiares"
      },
      "facilitator": {
        "title": "Asientos de Facilitador",
        "description": "Invitar facilitadores para ayudar a gestionar proyectos"
      },
      "storyteller": {
        "title": "Asientos de Narrador",
        "description": "Invitar miembros de la familia para compartir sus historias"
      }
    },
    "purchase": {
      "project": {
        "title": "Vale de Proyecto",
        "description": "Crear un proyecto adicional de historia familiar"
      },
      "facilitator": {
        "title": "Asiento de Facilitador",
        "description": "Invitar un facilitador para ayudar a gestionar proyectos"
      },
      "storyteller": {
        "title": "Asiento de Narrador",
        "description": "Invitar un narrador adicional a tus proyectos"
      },
      "button": "Comprar"
    },
    "alerts": {
      "purchaseComingSoon": "La funcionalidad de compra de asiento {type} estará disponible pronto"
    }
  },
  'fr': {
    "title": "Mes Ressources",
    "subtitle": "Gérez vos sièges disponibles et achetez des ressources supplémentaires",
    "buyMoreSeats": "Acheter Plus de Sièges",
    "available": "Disponible",
    "usage": "Utilisation",
    "usageStats": "{used} sur {total} utilisés",
    "buyMore": "Acheter Plus (${price} chacun)",
    "recentActivity": "Activité Récente",
    "purchaseAdditional": "Acheter des Sièges Supplémentaires",
    "packagePromo": "Besoin de plusieurs sièges ? Obtenez une meilleure valeur avec notre forfait complet.",
    "viewPackage": "Voir le Forfait Saga ($29)",
    "types": {
      "project": {
        "title": "Bons de Projet",
        "description": "Créer de nouveaux projets d'histoires familiales"
      },
      "facilitator": {
        "title": "Sièges de Facilitateur",
        "description": "Inviter des facilitateurs pour aider à gérer les projets"
      },
      "storyteller": {
        "title": "Sièges de Conteur",
        "description": "Inviter des membres de la famille pour partager leurs histoires"
      }
    },
    "purchase": {
      "project": {
        "title": "Bon de Projet",
        "description": "Créer un projet d'histoire familiale supplémentaire"
      },
      "facilitator": {
        "title": "Siège de Facilitateur",
        "description": "Inviter un facilitateur pour aider à gérer les projets"
      },
      "storyteller": {
        "title": "Siège de Conteur",
        "description": "Inviter un conteur supplémentaire à vos projets"
      },
      "button": "Acheter"
    },
    "alerts": {
      "purchaseComingSoon": "La fonctionnalité d'achat de siège {type} arrive bientôt"
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

console.log('Updating es and fr resources.json translations...\n');
for (const [lang, trans] of Object.entries(resourcesTranslations)) {
  updateResourcesTranslations(lang, trans);
}

console.log('\nES and FR resources.json translations completed!');
