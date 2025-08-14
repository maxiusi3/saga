import sgMail from '@sendgrid/mail'

if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY environment variable is required')
}

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export const sendgrid = sgMail

export const SENDGRID_CONFIG = {
  apiKey: process.env.SENDGRID_API_KEY,
  fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@saga.app',
  fromName: process.env.SENDGRID_FROM_NAME || 'Saga Family Biography',
  replyToEmail: process.env.SENDGRID_REPLY_TO_EMAIL || 'support@saga.app',
} as const

// Validate SendGrid configuration
export const validateSendGridConfig = (): boolean => {
  try {
    if (!SENDGRID_CONFIG.apiKey) {
      console.warn('SendGrid API key not configured')
      return false
    }
    
    console.log('✅ SendGrid configuration validated')
    return true
  } catch (error) {
    console.error('❌ SendGrid configuration error:', error)
    return false
  }
}