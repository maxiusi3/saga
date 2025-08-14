import { sendgrid, SENDGRID_CONFIG } from '../config/sendgrid'
import { UserModel } from '../models/user'
import { NotificationService } from './notification-service'
import { 
  EmailTemplateService, 
  WelcomeEmailData, 
  InvitationEmailData, 
  ExportReadyEmailData,
  ProjectArchivedEmailData,
  SubscriptionExpiringEmailData,
  SubscriptionRenewedEmailData
} from './email-template-service'
import type { NotificationType } from '@saga/shared/types'

export interface EmailNotificationPayload {
  title: string
  body: string
  data?: Record<string, any>
}

export interface EmailNotificationResult {
  success: boolean
  messageId?: string
  error?: string
}

export class EmailNotificationService {
  /**
   * Send welcome email to a new user
   */
  static async sendWelcomeEmail(userId: string, data: WelcomeEmailData): Promise<EmailNotificationResult> {
    try {
      const user = await UserModel.findById(userId)
      if (!user || !user.email) {
        return {
          success: false,
          error: 'User not found or no email address',
        }
      }

      const { html, subject } = await EmailTemplateService.renderWelcomeEmail(data)

      const msg = {
        to: user.email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject,
        html,
        categories: ['welcome', 'onboarding'],
        customArgs: {
          userId,
          emailType: 'welcome'
        }
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error) {
      console.error('Error sending welcome email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send invitation email
   */
  static async sendInvitationEmail(email: string, data: InvitationEmailData): Promise<EmailNotificationResult> {
    try {
      const { html, subject } = await EmailTemplateService.renderInvitationEmail(data)

      const msg = {
        to: email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject,
        html,
        categories: ['invitation', 'collaboration'],
        customArgs: {
          emailType: 'invitation',
          role: data.role
        }
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error) {
      console.error('Error sending invitation email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send export ready email
   */
  static async sendExportReadyEmail(userId: string, data: ExportReadyEmailData): Promise<EmailNotificationResult> {
    try {
      const user = await UserModel.findById(userId)
      if (!user || !user.email) {
        return {
          success: false,
          error: 'User not found or no email address',
        }
      }

      const { html, subject } = await EmailTemplateService.renderExportReadyEmail(data)

      const msg = {
        to: user.email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject,
        html,
        categories: ['export', 'download'],
        customArgs: {
          userId,
          emailType: 'export-ready',
          exportType: data.exportType
        }
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error) {
      console.error('Error sending export ready email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send notification email to a user (legacy method for backward compatibility)
   */
  static async sendNotificationEmail(
    userId: string,
    type: NotificationType,
    payload: EmailNotificationPayload
  ): Promise<EmailNotificationResult> {
    try {
      const user = await UserModel.findById(userId)
      if (!user || !user.email) {
        return {
          success: false,
          error: 'User not found or no email address',
        }
      }

      const template = NotificationService.getNotificationTemplate(type, payload.data)
      const emailContent = this.generateEmailContent(type, payload, template)

      const msg = {
        to: user.email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject: template.emailSubject || template.title,
        html: emailContent.html,
        text: emailContent.text,
        categories: ['notification', type],
        customArgs: {
          userId,
          notificationType: type,
        },
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error: any) {
      console.error('Error sending email notification:', error)
      
      return {
        success: false,
        error: error.message || 'Failed to send email',
      }
    }
  }

  /**
   * Send bulk email notifications
   */
  static async sendBulkNotificationEmails(
    userIds: string[],
    type: NotificationType,
    payload: EmailNotificationPayload
  ): Promise<EmailNotificationResult[]> {
    const results: EmailNotificationResult[] = []

    // Process in batches to avoid rate limits
    const batchSize = 10
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize)
      
      const batchPromises = batch.map(userId => 
        this.sendNotificationEmail(userId, type, payload)
      )

      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
          })
        }
      })

      // Add delay between batches to respect rate limits
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  /**
   * Send welcome email to new users
   */
  static async sendWelcomeEmail(userId: string, invitationData?: any): Promise<EmailNotificationResult> {
    try {
      const user = await UserModel.findById(userId)
      if (!user || !user.email) {
        return {
          success: false,
          error: 'User not found or no email address',
        }
      }

      const emailContent = this.generateWelcomeEmailContent(user.name, invitationData)

      const msg = {
        to: user.email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject: 'Welcome to Saga - Start Sharing Your Family Stories',
        html: emailContent.html,
        text: emailContent.text,
        categories: ['welcome', 'onboarding'],
        customArgs: {
          userId,
          emailType: 'welcome',
        },
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error: any) {
      console.error('Error sending welcome email:', error)
      
      return {
        success: false,
        error: error.message || 'Failed to send welcome email',
      }
    }
  }

  /**
   * Send invitation email
   */
  static async sendInvitationEmail(
    email: string,
    invitationToken: string,
    facilitatorName: string,
    projectTitle: string
  ): Promise<EmailNotificationResult> {
    try {
      const invitationUrl = `${process.env.WEB_APP_URL}/invitation/${invitationToken}`
      const emailContent = this.generateInvitationEmailContent(
        facilitatorName,
        projectTitle,
        invitationUrl
      )

      const msg = {
        to: email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject: `${facilitatorName} invited you to share your family stories on Saga`,
        html: emailContent.html,
        text: emailContent.text,
        categories: ['invitation'],
        customArgs: {
          invitationToken,
          emailType: 'invitation',
        },
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error: any) {
      console.error('Error sending invitation email:', error)
      
      return {
        success: false,
        error: error.message || 'Failed to send invitation email',
      }
    }
  }

  /**
   * Generate email content for notifications
   */
  private static generateEmailContent(
    type: NotificationType,
    payload: EmailNotificationPayload,
    template: any
  ): { html: string; text: string } {
    const baseUrl = process.env.WEB_APP_URL || 'https://saga.app'
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .button:hover { background: #4f46e5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Saga</h1>
          </div>
          <div class="content">
            <h2>${template.title}</h2>
            <p>${payload.body}</p>
            ${this.getNotificationActionButton(type, payload.data, baseUrl)}
            <p>Thank you for using Saga to preserve your family stories.</p>
          </div>
          <div class="footer">
            <p>© 2024 Saga. All rights reserved.</p>
            <p>You can manage your notification preferences in your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `
      ${template.title}
      
      ${payload.body}
      
      ${this.getNotificationActionText(type, payload.data, baseUrl)}
      
      Thank you for using Saga to preserve your family stories.
      
      © 2024 Saga. All rights reserved.
      You can manage your notification preferences in your account settings.
    `

    return { html, text }
  }

  /**
   * Generate welcome email content
   */
  private static generateWelcomeEmailContent(userName: string, invitationData?: any): { html: string; text: string } {
    const baseUrl = process.env.WEB_APP_URL || 'https://saga.app'
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Saga</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Saga</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Welcome to Saga, where family stories come alive. We're excited to help you preserve and share your precious memories.</p>
            
            ${invitationData ? `
              <p>You've been invited to share your stories in the "${invitationData.projectTitle}" project. Your family is eager to hear your unique perspective and experiences.</p>
            ` : ''}
            
            <p>Here's how to get started:</p>
            <ul>
              <li>Record your stories using our easy-to-use mobile app</li>
              <li>Add photos to bring your memories to life</li>
              <li>Engage with family members through comments and questions</li>
              <li>Watch as your family history unfolds</li>
            </ul>
            
            <a href="${baseUrl}/dashboard" class="button">Get Started</a>
            
            <p>If you have any questions, our support team is here to help. Simply reply to this email.</p>
            
            <p>Happy storytelling!</p>
            <p>The Saga Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Saga. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `
      Welcome to Saga!
      
      Hello ${userName}!
      
      Welcome to Saga, where family stories come alive. We're excited to help you preserve and share your precious memories.
      
      ${invitationData ? `You've been invited to share your stories in the "${invitationData.projectTitle}" project. Your family is eager to hear your unique perspective and experiences.` : ''}
      
      Here's how to get started:
      - Record your stories using our easy-to-use mobile app
      - Add photos to bring your memories to life
      - Engage with family members through comments and questions
      - Watch as your family history unfolds
      
      Get started: ${baseUrl}/dashboard
      
      If you have any questions, our support team is here to help. Simply reply to this email.
      
      Happy storytelling!
      The Saga Team
      
      © 2024 Saga. All rights reserved.
    `

    return { html, text }
  }

  /**
   * Generate invitation email content
   */
  private static generateInvitationEmailContent(
    facilitatorName: string,
    projectTitle: string,
    invitationUrl: string
  ): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're Invited to Share Your Stories</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited!</h1>
          </div>
          <div class="content">
            <h2>Share Your Family Stories</h2>
            <p><strong>${facilitatorName}</strong> has invited you to contribute to the <strong>"${projectTitle}"</strong> family story collection on Saga.</p>
            
            <p>Your unique memories and experiences are an important part of your family's history. By sharing your stories, you'll help create a lasting legacy for future generations.</p>
            
            <p>Saga makes it easy to:</p>
            <ul>
              <li>Record stories with our simple mobile app</li>
              <li>Add photos to illustrate your memories</li>
              <li>Respond to thoughtful prompts and questions</li>
              <li>Connect with family members through your shared history</li>
            </ul>
            
            <a href="${invitationUrl}" class="button">Accept Invitation</a>
            
            <p>This invitation is personal to you and will help you get started quickly. If you have any questions, feel free to reach out to ${facilitatorName} or our support team.</p>
            
            <p>We can't wait to hear your stories!</p>
            <p>The Saga Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Saga. All rights reserved.</p>
            <p>If you don't want to receive these emails, you can decline this invitation.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `
      You're Invited to Share Your Family Stories!
      
      ${facilitatorName} has invited you to contribute to the "${projectTitle}" family story collection on Saga.
      
      Your unique memories and experiences are an important part of your family's history. By sharing your stories, you'll help create a lasting legacy for future generations.
      
      Saga makes it easy to:
      - Record stories with our simple mobile app
      - Add photos to illustrate your memories
      - Respond to thoughtful prompts and questions
      - Connect with family members through your shared history
      
      Accept your invitation: ${invitationUrl}
      
      This invitation is personal to you and will help you get started quickly. If you have any questions, feel free to reach out to ${facilitatorName} or our support team.
      
      We can't wait to hear your stories!
      The Saga Team
      
      © 2024 Saga. All rights reserved.
    `

    return { html, text }
  }

  /**
   * Get action button for notification emails
   */
  private static getNotificationActionButton(type: NotificationType, data?: any, baseUrl?: string): string {
    if (!baseUrl) return ''

    switch (type) {
      case 'story_uploaded':
        return data?.projectId 
          ? `<a href="${baseUrl}/projects/${data.projectId}" class="button">View Story</a>`
          : `<a href="${baseUrl}/dashboard" class="button">View Dashboard</a>`
      
      case 'interaction_added':
      case 'follow_up_question':
        return data?.storyId 
          ? `<a href="${baseUrl}/stories/${data.storyId}" class="button">View Story</a>`
          : `<a href="${baseUrl}/dashboard" class="button">View Dashboard</a>`
      
      case 'export_ready':
        return data?.exportId 
          ? `<a href="${baseUrl}/exports/${data.exportId}" class="button">Download Export</a>`
          : `<a href="${baseUrl}/exports" class="button">View Exports</a>`
      
      case 'invitation_received':
        return data?.invitationToken 
          ? `<a href="${baseUrl}/invitation/${data.invitationToken}" class="button">Accept Invitation</a>`
          : ''
      
      default:
        return `<a href="${baseUrl}/dashboard" class="button">View Dashboard</a>`
    }
  }

  /**
   * Send project archived email
   */
  static async sendProjectArchivedEmail(userId: string, data: ProjectArchivedEmailData): Promise<EmailNotificationResult> {
    try {
      const user = await UserModel.findById(userId)
      if (!user || !user.email) {
        return {
          success: false,
          error: 'User not found or no email address',
        }
      }

      const { html, subject } = await EmailTemplateService.renderProjectArchivedEmail(data)

      const msg = {
        to: user.email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject,
        html,
        categories: ['archival', 'project-archived'],
        customArgs: {
          userId,
          emailType: 'project-archived',
          projectName: data.projectName
        }
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error) {
      console.error('Error sending project archived email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send subscription expiring email
   */
  static async sendSubscriptionExpiringEmail(userId: string, data: SubscriptionExpiringEmailData): Promise<EmailNotificationResult> {
    try {
      const user = await UserModel.findById(userId)
      if (!user || !user.email) {
        return {
          success: false,
          error: 'User not found or no email address',
        }
      }

      const { html, subject } = await EmailTemplateService.renderSubscriptionExpiringEmail(data)

      const msg = {
        to: user.email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject,
        html,
        categories: ['subscription', 'expiring-warning'],
        customArgs: {
          userId,
          emailType: 'subscription-expiring',
          projectName: data.projectName,
          daysUntilExpiry: data.daysUntilExpiry.toString()
        }
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error) {
      console.error('Error sending subscription expiring email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send subscription renewed email
   */
  static async sendSubscriptionRenewedEmail(userId: string, data: SubscriptionRenewedEmailData): Promise<EmailNotificationResult> {
    try {
      const user = await UserModel.findById(userId)
      if (!user || !user.email) {
        return {
          success: false,
          error: 'User not found or no email address',
        }
      }

      const { html, subject } = await EmailTemplateService.renderSubscriptionRenewedEmail(data)

      const msg = {
        to: user.email,
        from: {
          email: SENDGRID_CONFIG.fromEmail,
          name: SENDGRID_CONFIG.fromName,
        },
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject,
        html,
        categories: ['subscription', 'renewed'],
        customArgs: {
          userId,
          emailType: 'subscription-renewed',
          projectName: data.projectName
        }
      }

      const response = await sendgrid.send(msg)
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }
    } catch (error) {
      console.error('Error sending subscription renewed email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get action text for plain text emails
   */
  private static getNotificationActionText(type: NotificationType, data?: any, baseUrl?: string): string {
    if (!baseUrl) return ''

    switch (type) {
      case 'story_uploaded':
        return data?.projectId 
          ? `View the story: ${baseUrl}/projects/${data.projectId}`
          : `View your dashboard: ${baseUrl}/dashboard`
      
      case 'interaction_added':
      case 'follow_up_question':
        return data?.storyId 
          ? `View the story: ${baseUrl}/stories/${data.storyId}`
          : `View your dashboard: ${baseUrl}/dashboard`
      
      case 'export_ready':
        return data?.exportId 
          ? `Download your export: ${baseUrl}/exports/${data.exportId}`
          : `View your exports: ${baseUrl}/exports`
      
      case 'invitation_received':
        return data?.invitationToken 
          ? `Accept the invitation: ${baseUrl}/invitation/${data.invitationToken}`
          : ''
      
      default:
        return `View your dashboard: ${baseUrl}/dashboard`
    }
  }
}