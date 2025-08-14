export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s-()]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10
}

export const validatePassword = (password: string): boolean => {
  return password.length >= 8 && 
         /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)
}

export const validateAudioFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 50 * 1024 * 1024 // 50MB
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac']
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' }
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid audio format. Supported formats: MP3, WAV, MP4, AAC' }
  }
  
  return { valid: true }
}

export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size must be less than 10MB' }
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid image format. Supported formats: JPEG, PNG, WebP' }
  }
  
  return { valid: true }
}