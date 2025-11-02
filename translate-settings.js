const fs = require('fs');
const path = require('path');

const baseDir = 'packages/web/public/locales';

const settingsTranslations = {
  'es': {
    "title": "Configuración",
    "subtitle": "Gestiona las preferencias de tu cuenta y la configuración de privacidad",
    "loading": "Cargando tus preferencias...",
    "userInfo": {
      "title": "Información del Usuario",
      "changePhoto": "Cambiar Foto",
      "photoHint": "JPG, PNG o GIF. Tamaño máximo 2MB.",
      "fullName": "Nombre Completo",
      "email": "Correo Electrónico",
      "phone": "Número de Teléfono",
      "phonePlaceholder": "(555) 123-4567",
      "saveChanges": "Guardar Cambios"
    },
    "quickAccess": {
      "title": "Acceso Rápido",
      "description": "Ajusta rápidamente la accesibilidad y la configuración de visualización para una mejor usabilidad.",
      "highContrast": {
        "title": "Alto Contraste",
        "description": "Mejorar la visibilidad del texto"
      },
      "reducedMotion": {
        "title": "Movimiento Reducido",
        "description": "Minimizar animaciones"
      },
      "screenReader": {
        "title": "Lector de Pantalla",
        "description": "Soporte mejorado para lectores de pantalla"
      },
      "fontSize": {
        "title": "Tamaño de Fuente",
        "current": "Actual: {size}",
        "standard": "Estándar",
        "large": "Grande",
        "extraLarge": "Extra Grande"
      },
      "save": "Guardar Configuración de Acceso Rápido"
    },
    "audio": {
      "title": "Configuración de Audio",
      "volume": "Volumen",
      "quality": "Calidad de Audio",
      "qualityOptions": {
        "low": "Baja (Carga más rápida)",
        "medium": "Media (Equilibrada)",
        "high": "Alta (Mejor calidad)"
      }
    },
    "privacy": {
      "title": "Privacidad y Seguridad",
      "profileVisibility": {
        "title": "Visibilidad del Perfil",
        "description": "Hacer tu perfil visible para otros miembros de la familia"
      },
      "storySharing": {
        "title": "Compartir Historias",
        "description": "Permitir que otros compartan tus historias"
      },
      "dataAnalytics": {
        "title": "Análisis de Datos",
        "description": "Ayuda a mejorar nuestro servicio con datos de uso"
      },
      "twoFactor": {
        "title": "Autenticación de Dos Factores",
        "description": "Añade una capa extra de seguridad"
      }
    },
    "notifications": {
      "title": "Notificaciones",
      "email": {
        "title": "Notificaciones por Correo",
        "description": "Recibir actualizaciones por correo electrónico"
      },
      "push": {
        "title": "Notificaciones Push",
        "description": "Recibir notificaciones en tus dispositivos"
      },
      "weeklyDigest": {
        "title": "Resumen Semanal",
        "description": "Resumen semanal de la actividad familiar"
      },
      "save": "Guardar Configuración de Notificaciones"
    },
    "language": {
      "title": "Idioma y Región",
      "language": "Idioma",
      "timezone": "Zona Horaria",
      "timezones": {
        "pst": "Hora Estándar del Pacífico",
        "mst": "Hora Estándar de la Montaña",
        "cst": "Hora Estándar Central",
        "est": "Hora Estándar del Este"
      }
    },
    "dataManagement": {
      "title": "Gestión de Datos",
      "export": {
        "title": "Exportar Mis Datos",
        "description": "Descargar todas tus historias y datos",
        "button": "Exportar"
      },
      "privacy": {
        "title": "Privacidad de Datos",
        "description": "Controla cómo se usan tus datos"
      }
    },
    "account": {
      "title": "Gestión de Cuenta",
      "changePassword": {
        "title": "Cambiar Contraseña",
        "description": "Actualiza la contraseña de tu cuenta",
        "button": "Cambiar"
      },
      "twoFactor": {
        "title": "Autenticación de Dos Factores",
        "description": "Añade seguridad extra a tu cuenta",
        "button": "Configurar"
      },
      "devices": {
        "title": "Dispositivos Conectados",
        "description": "Gestiona tus dispositivos con sesión iniciada",
        "button": "Gestionar"
      }
    },
    "dangerZone": {
      "title": "Zona de Peligro",
      "deleteAccount": {
        "title": "Eliminar Cuenta",
        "description": "Elimina permanentemente tu cuenta y todos los datos asociados. Esta acción no se puede deshacer.",
        "button": "Eliminar Cuenta"
      }
    },
    "messages": {
      "profileUpdated": "Perfil actualizado correctamente",
      "profileUpdateFailed": "Error al actualizar el perfil",
      "notificationsUpdated": "Configuración de notificaciones actualizada correctamente",
      "notificationsUpdateFailed": "Error al actualizar la configuración de notificaciones",
      "accessibilityUpdated": "Configuración de accesibilidad actualizada correctamente",
      "accessibilityUpdateFailed": "Error al actualizar la configuración de accesibilidad",
      "loadFailed": "Error al cargar la configuración. Usando valores predeterminados."
    }
  },
  'fr': {
    "title": "Paramètres",
    "subtitle": "Gérez vos préférences de compte et paramètres de confidentialité",
    "loading": "Chargement de vos préférences...",
    "userInfo": {
      "title": "Informations Utilisateur",
      "changePhoto": "Changer la Photo",
      "photoHint": "JPG, PNG ou GIF. Taille max 2MB.",
      "fullName": "Nom Complet",
      "email": "Adresse Email",
      "phone": "Numéro de Téléphone",
      "phonePlaceholder": "(555) 123-4567",
      "saveChanges": "Enregistrer les Modifications"
    },
    "quickAccess": {
      "title": "Accès Rapide",
      "description": "Ajustez rapidement les paramètres d'accessibilité et d'affichage pour une meilleure utilisabilité.",
      "highContrast": {
        "title": "Contraste Élevé",
        "description": "Améliorer la visibilité du texte"
      },
      "reducedMotion": {
        "title": "Mouvement Réduit",
        "description": "Minimiser les animations"
      },
      "screenReader": {
        "title": "Lecteur d'Écran",
        "description": "Support amélioré pour les lecteurs d'écran"
      },
      "fontSize": {
        "title": "Taille de Police",
        "current": "Actuel: {size}",
        "standard": "Standard",
        "large": "Grand",
        "extraLarge": "Très Grand"
      },
      "save": "Enregistrer les Paramètres d'Accès Rapide"
    },
    "audio": {
      "title": "Paramètres Audio",
      "volume": "Volume",
      "quality": "Qualité Audio",
      "qualityOptions": {
        "low": "Faible (Chargement plus rapide)",
        "medium": "Moyen (Équilibré)",
        "high": "Élevé (Meilleure qualité)"
      }
    },
    "privacy": {
      "title": "Confidentialité et Sécurité",
      "profileVisibility": {
        "title": "Visibilité du Profil",
        "description": "Rendre votre profil visible aux autres membres de la famille"
      },
      "storySharing": {
        "title": "Partage d'Histoires",
        "description": "Permettre aux autres de partager vos histoires"
      },
      "dataAnalytics": {
        "title": "Analyse de Données",
        "description": "Aidez à améliorer notre service avec les données d'utilisation"
      },
      "twoFactor": {
        "title": "Authentification à Deux Facteurs",
        "description": "Ajouter une couche de sécurité supplémentaire"
      }
    },
    "notifications": {
      "title": "Notifications",
      "email": {
        "title": "Notifications par Email",
        "description": "Recevoir des mises à jour par email"
      },
      "push": {
        "title": "Notifications Push",
        "description": "Recevoir des notifications sur vos appareils"
      },
      "weeklyDigest": {
        "title": "Résumé Hebdomadaire",
        "description": "Résumé hebdomadaire de l'activité familiale"
      },
      "save": "Enregistrer les Paramètres de Notification"
    },
    "language": {
      "title": "Langue et Région",
      "language": "Langue",
      "timezone": "Fuseau Horaire",
      "timezones": {
        "pst": "Heure Standard du Pacifique",
        "mst": "Heure Standard des Montagnes",
        "cst": "Heure Standard du Centre",
        "est": "Heure Standard de l'Est"
      }
    },
    "dataManagement": {
      "title": "Gestion des Données",
      "export": {
        "title": "Exporter Mes Données",
        "description": "Télécharger toutes vos histoires et données",
        "button": "Exporter"
      },
      "privacy": {
        "title": "Confidentialité des Données",
        "description": "Contrôlez comment vos données sont utilisées"
      }
    },
    "account": {
      "title": "Gestion du Compte",
      "changePassword": {
        "title": "Changer le Mot de Passe",
        "description": "Mettre à jour le mot de passe de votre compte",
        "button": "Changer"
      },
      "twoFactor": {
        "title": "Authentification à Deux Facteurs",
        "description": "Ajouter une sécurité supplémentaire à votre compte",
        "button": "Configurer"
      },
      "devices": {
        "title": "Appareils Connectés",
        "description": "Gérer vos appareils connectés",
        "button": "Gérer"
      }
    },
    "dangerZone": {
      "title": "Zone Dangereuse",
      "deleteAccount": {
        "title": "Supprimer le Compte",
        "description": "Supprimer définitivement votre compte et toutes les données associées. Cette action ne peut pas être annulée.",
        "button": "Supprimer le Compte"
      }
    },
    "messages": {
      "profileUpdated": "Profil mis à jour avec succès",
      "profileUpdateFailed": "Échec de la mise à jour du profil",
      "notificationsUpdated": "Paramètres de notification mis à jour avec succès",
      "notificationsUpdateFailed": "Échec de la mise à jour des paramètres de notification",
      "accessibilityUpdated": "Paramètres d'accessibilité mis à jour avec succès",
      "accessibilityUpdateFailed": "Échec de la mise à jour des paramètres d'accessibilité",
      "loadFailed": "Échec du chargement des paramètres. Utilisation des valeurs par défaut."
    }
  }
};

// Create settings.json for each language
for (const [lang, translations] of Object.entries(settingsTranslations)) {
  const filePath = path.join(baseDir, lang, 'settings.json');
  fs.writeFileSync(filePath, JSON.stringify(translations, null, 2) + '\n');
  console.log(`✓ Created ${lang}/settings.json`);
}

console.log('\nSettings translations created for es and fr!');
console.log('Note: Remaining languages (ja, ko, pt, zh-CN, zh-TW) will need professional translation.');
