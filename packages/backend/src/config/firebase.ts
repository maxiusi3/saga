import admin from 'firebase-admin'

// In test environment, Firebase is optional
const isTestEnvironment = process.env.NODE_ENV === 'test'

if (!process.env.FIREBASE_SERVER_KEY && !isTestEnvironment) {
  throw new Error('FIREBASE_SERVER_KEY environment variable is required')
}

// Initialize Firebase Admin SDK (skip in test environment)
if (!admin.apps.length && !isTestEnvironment && process.env.FIREBASE_SERVER_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export const firebaseAdmin = admin

export const FIREBASE_CONFIG = {
  serverKey: process.env.FIREBASE_SERVER_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
} as const

// Validate Firebase configuration
export const validateFirebaseConfig = (): boolean => {
  try {
    if (!FIREBASE_CONFIG.serverKey) {
      console.warn('Firebase server key not configured')
      return false
    }
    
    console.log('✅ Firebase configuration validated')
    return true
  } catch (error) {
    console.error('❌ Firebase configuration error:', error)
    return false
  }
}