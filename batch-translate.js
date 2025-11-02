#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const baseDir = 'packages/web/public/locales';

const translations = {
  'fr': {
    'create-project.json': {
      "header": {
        "backToProjects": "Retour aux Projets",
        "title": "Créer une Nouvelle Biographie Familiale",
        "subtitle": "Commencez à enregistrer les précieuses histoires de votre famille"
      },
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
    }
  }
};

function setValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

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

// Apply translations
for (const [lang, files] of Object.entries(translations)) {
  for (const [file, trans] of Object.entries(files)) {
    applyTranslations(lang, file, trans);
  }
}

console.log('\nTranslations applied successfully!');
