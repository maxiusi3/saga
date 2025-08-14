import fs from 'fs/promises'
import path from 'path'
import Handlebars from 'handlebars'

/**
 * Email template data interfaces
 */
export interface WelcomeEmailData {
  userName: string
  projectVouchers: number
  facilitatorSeats: number
  storytellerSeats: number
  dashboardUrl: string
  helpCenterUrl: string
  supportEmail: string
}

export interface InvitationEmailData {
  facilitatorName: string
  projectName: string
  role: 'facilitator' | 'storyteller'
  invitationUrl: string
  supportEmail: string
}

export interface ExportReadyEmailData {
  userName: string
  projectName: string
  exportType: string
  fileSize: string
  storyCount: number
  generatedDate: string
  includesAudio: boolean
  includesPhotos: boolean
  downloadUrl: string
}

export interface ProjectArchivedEmailData {
  userName: string
  projectName: string
  renewalUrl: string
  projectUrl: string
  supportEmail: string
}

export interface SubscriptionExpiringEmailData {
  userName: string
  projectName: string
  daysUntilExpiry: number
  renewalUrl: string
  projectUrl: string
  supportEmail: string
}

export interface SubscriptionRenewedEmailData {
  userName: string
  projectName: string
  newExpiryDate: string
  projectUrl: string
  supportEmail: string
}

export interface BaseEmailData {
  subject: string
  unsubscribeUrl: string
  supportUrl: string
  privacyUrl: string
  currentYear: number
  companyAddress: string
}

/**
 * Service for managing email templates
 */
export class EmailTemplateService {
  private static templateCache = new Map<string, HandlebarsTemplateDelegate>()
  private static templatesPath = path.join(__dirname, '../templates/email')

  /**
   * Initialize Handlebars helpers
   */
  static {
    // Register Handlebars helpers
    Handlebars.registerHelper('eq', (a, b) => a === b)
    Handlebars.registerHelper('gt', (a, b) => a > b)
    Handlebars.registerHelper('if', function(conditional, options) {
      if (conditional) {
        return options.fn(this)
      } else {
        return options.inverse(this)
      }
    })
  }

  /**
   * Load and compile a template
   */
  private static async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!
    }

    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.html`)
      const templateContent = await fs.readFile(templatePath, 'utf-8')
      
      // Compile the template
      const compiledTemplate = Handlebars.compile(templateContent)
      
      // Cache the compiled template
      this.templateCache.set(templateName, compiledTemplate)
      
      return compiledTemplate
    } catch (error) {
      console.error(`Error loading email template ${templateName}:`, error)
      throw new Error(`Failed to load email template: ${templateName}`)
    }
  }

  /**
   * Get base template data
   */
  private static getBaseData(): BaseEmailData {
    return {
      subject: '',
      unsubscribeUrl: process.env.FRONTEND_URL + '/unsubscribe',
      supportUrl: process.env.FRONTEND_URL + '/support',
      privacyUrl: process.env.FRONTEND_URL + '/privacy',
      currentYear: new Date().getFullYear(),
      companyAddress: '123 Story Lane, Memory City, MC 12345'
    }
  }

  /**
   * Render welcome email
   */
  static async renderWelcomeEmail(data: WelcomeEmailData): Promise<{
    html: string
    subject: string
  }> {
    try {
      const template = await this.loadTemplate('welcome')
      const baseData = this.getBaseData()
      
      const templateData = {
        ...baseData,
        ...data,
        subject: 'Welcome to Saga - Your Family Story Journey Begins!',
        headerTitle: 'Welcome to Saga!',
        headerSubtitle: 'Your journey of preserving family stories begins now'
      }

      const html = template(templateData)
      
      return {
        html,
        subject: templateData.subject
      }
    } catch (error) {
      console.error('Error rendering welcome email:', error)
      throw error
    }
  }

  /**
   * Render invitation email
   */
  static async renderInvitationEmail(data: InvitationEmailData): Promise<{
    html: string
    subject: string
  }> {
    try {
      const template = await this.loadTemplate('invitation')
      const baseData = this.getBaseData()
      
      const subject = data.role === 'storyteller' 
        ? `${data.facilitatorName} invited you to share your family stories`
        : `${data.facilitatorName} invited you to collaborate on "${data.projectName}"`
      
      const templateData = {
        ...baseData,
        ...data,
        subject,
        headerTitle: 'You\'re Invited to Share Your Stories',
        headerSubtitle: `${data.facilitatorName} wants to preserve your family memories`
      }

      const html = template(templateData)
      
      return {
        html,
        subject
      }
    } catch (error) {
      console.error('Error rendering invitation email:', error)
      throw error
    }
  }

  /**
   * Render export ready email
   */
  static async renderExportReadyEmail(data: ExportReadyEmailData): Promise<{
    html: string
    subject: string
  }> {
    try {
      const template = await this.loadTemplate('export-ready')
      const baseData = this.getBaseData()
      
      const subject = `Your "${data.projectName}" export is ready for download!`
      
      const templateData = {
        ...baseData,
        ...data,
        subject,
        headerTitle: 'Your Family Stories Export is Ready! 📚',
        headerSubtitle: 'Download your complete collection of precious memories'
      }

      const html = template(templateData)
      
      return {
        html,
        subject
      }
    } catch (error) {
      console.error('Error rendering export ready email:', error)
      throw error
    }
  }

  /**
   * Render a generic template with custom data
   */
  static async renderTemplate(
    templateName: string, 
    data: Record<string, any>
  ): Promise<{
    html: string
    subject: string
  }> {
    try {
      const template = await this.loadTemplate(templateName)
      const baseData = this.getBaseData()
      
      const templateData = {
        ...baseData,
        ...data
      }

      const html = template(templateData)
      
      return {
        html,
        subject: data.subject || 'Saga Notification'
      }
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error)
      throw error
    }
  }

  /**
   * Clear template cache (useful for development)
   */
  static clearCache(): void {
    this.templateCache.clear()
    console.log('Email template cache cleared')
  }

  /**
   * Preload commonly used templates
   */
  static async preloadTemplates(): Promise<void> {
    try {
      const commonTemplates = ['welcome', 'invitation', 'export-ready']
      
      await Promise.all(
        commonTemplates.map(template => this.loadTemplate(template))
      )
      
      console.log('Email templates preloaded successfully')
    } catch (error) {
      console.error('Error preloading email templates:', error)
    }
  }

  /**
   * Get available templates
   */
  static async getAvailableTemplates(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.templatesPath)
      return files
        .filter(file => file.endsWith('.html'))
        .map(file => file.replace('.html', ''))
    } catch (error) {
      console.error('Error getting available templates:', error)
      return []
    }
  }

  /**
   * Render project archived email
   */
  static async renderProjectArchivedEmail(data: ProjectArchivedEmailData): Promise<{
    html: string
    subject: string
  }> {
    try {
      const template = await this.loadTemplate('project-archived')
      const baseData = this.getBaseData()
      
      const subject = `Your project "${data.projectName}" has been archived`
      
      const templateData = {
        ...baseData,
        ...data,
        subject,
        headerTitle: 'Project Archived',
        headerSubtitle: 'Your stories are safe and accessible'
      }

      const html = template(templateData)
      
      return {
        html,
        subject
      }
    } catch (error) {
      console.error('Error rendering project archived email:', error)
      throw error
    }
  }

  /**
   * Render subscription expiring email
   */
  static async renderSubscriptionExpiringEmail(data: SubscriptionExpiringEmailData): Promise<{
    html: string
    subject: string
  }> {
    try {
      const template = await this.loadTemplate('subscription-expiring')
      const baseData = this.getBaseData()
      
      const subject = `Your Saga subscription expires in ${data.daysUntilExpiry} day${data.daysUntilExpiry > 1 ? 's' : ''}`
      
      const templateData = {
        ...baseData,
        ...data,
        subject,
        headerTitle: 'Subscription Expiring Soon',
        headerSubtitle: 'Renew now to keep sharing stories'
      }

      const html = template(templateData)
      
      return {
        html,
        subject
      }
    } catch (error) {
      console.error('Error rendering subscription expiring email:', error)
      throw error
    }
  }

  /**
   * Render subscription renewed email
   */
  static async renderSubscriptionRenewedEmail(data: SubscriptionRenewedEmailData): Promise<{
    html: string
    subject: string
  }> {
    try {
      const template = await this.loadTemplate('subscription-renewed')
      const baseData = this.getBaseData()
      
      const subject = `Your Saga subscription has been renewed!`
      
      const templateData = {
        ...baseData,
        ...data,
        subject,
        headerTitle: 'Subscription Renewed!',
        headerSubtitle: 'Continue your family storytelling journey'
      }

      const html = template(templateData)
      
      return {
        html,
        subject
      }
    } catch (error) {
      console.error('Error rendering subscription renewed email:', error)
      throw error
    }
  }

  /**
   * Validate template data
   */
  static validateTemplateData(templateName: string, data: any): boolean {
    switch (templateName) {
      case 'welcome':
        return !!(data.userName && data.dashboardUrl)
      case 'invitation':
        return !!(data.facilitatorName && data.projectName && data.invitationUrl && data.role)
      case 'export-ready':
        return !!(data.userName && data.projectName && data.downloadUrl && data.exportType)
      case 'project-archived':
        return !!(data.userName && data.projectName && data.renewalUrl)
      case 'subscription-expiring':
        return !!(data.userName && data.projectName && data.daysUntilExpiry && data.renewalUrl)
      case 'subscription-renewed':
        return !!(data.userName && data.projectName && data.newExpiryDate)
      default:
        return true // Allow custom templates
    }
  }
}