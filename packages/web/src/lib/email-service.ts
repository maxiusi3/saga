import { createClient } from '@supabase/supabase-js'

// 使用Supabase内置的邮件服务
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface EmailTemplate {
  subject: string
  html: string
  text?: string
}

interface InvitationEmailData {
  inviterName: string
  projectName: string
  role: string
  inviteUrl: string
  expiresAt: string
}

interface NotificationEmailData {
  recipientName: string
  title: string
  message: string
  actionUrl?: string
}

export class EmailService {
  /**
   * 发送邀请邮件
   */
  static async sendInvitationEmail(
    recipientEmail: string,
    data: InvitationEmailData
  ): Promise<boolean> {
    try {
      const template = this.generateInvitationTemplate(data)
      
      // 使用Supabase Auth发送邮件
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        recipientEmail,
        {
          data: {
            invitation_type: 'project_invitation',
            project_name: data.projectName,
            inviter_name: data.inviterName,
            role: data.role,
            invite_url: data.inviteUrl
          },
          redirectTo: data.inviteUrl
        }
      )

      if (error) {
        console.error('Error sending invitation email:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in sendInvitationEmail:', error)
      return false
    }
  }

  /**
   * 发送通知邮件
   */
  static async sendNotificationEmail(
    recipientEmail: string,
    data: NotificationEmailData
  ): Promise<boolean> {
    try {
      // 对于通知邮件，我们可以使用Supabase的邮件功能
      // 或者集成第三方邮件服务如SendGrid、Resend等
      
      // 这里使用简单的日志记录，实际项目中可以集成真实的邮件服务
      console.log('Notification email would be sent:', {
        to: recipientEmail,
        subject: data.title,
        message: data.message,
        actionUrl: data.actionUrl
      })

      return true
    } catch (error) {
      console.error('Error in sendNotificationEmail:', error)
      return false
    }
  }

  /**
   * 生成邀请邮件模板
   */
  private static generateInvitationTemplate(data: InvitationEmailData): EmailTemplate {
    const expiryDate = new Date(data.expiresAt).toLocaleDateString()
    const roleDisplayName = data.role === 'facilitator' ? 'Co-Facilitator' : 'Storyteller'

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to Join ${data.projectName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
          .button:hover { background: #1d4ed8; }
          .role-badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
          .expiry-notice { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎭 Saga Family Biography</h1>
            <p>You've been invited to join a family story project</p>
          </div>
          
          <div class="content">
            <h2>Hello!</h2>
            <p><strong>${data.inviterName}</strong> has invited you to join the family biography project "<strong>${data.projectName}</strong>" as a <span class="role-badge">${roleDisplayName}</span>.</p>
            
            <p>Saga is an AI-powered platform that helps families capture, preserve, and share their stories across generations. As a ${roleDisplayName}, you'll be able to:</p>
            
            ${data.role === 'facilitator' ? `
              <ul>
                <li>Help guide storytelling sessions</li>
                <li>Add comments and follow-up questions</li>
                <li>Manage project settings and invite others</li>
                <li>Access all stories and transcripts</li>
              </ul>
            ` : `
              <ul>
                <li>Record and share your personal stories</li>
                <li>Respond to prompts and questions</li>
                <li>View your story transcripts and summaries</li>
                <li>Connect with family members</li>
              </ul>
            `}
            
            <div style="text-align: center;">
              <a href="${data.inviteUrl}" class="button">Accept Invitation</a>
            </div>
            
            <div class="expiry-notice">
              <strong>⏰ Important:</strong> This invitation expires on <strong>${expiryDate}</strong> for security reasons. Please accept it soon!
            </div>
            
            <p>If you have any questions about Saga or this invitation, feel free to reach out to ${data.inviterName} or visit our help center.</p>
          </div>
          
          <div class="footer">
            <p>This invitation was sent by ${data.inviterName} through Saga Family Biography Platform.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            <p><a href="${data.inviteUrl}">View Invitation</a> | <a href="https://saga.family/help">Help Center</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `
      You've been invited to join "${data.projectName}"
      
      ${data.inviterName} has invited you to join their family biography project as a ${roleDisplayName}.
      
      Saga is an AI-powered platform that helps families capture and preserve their stories.
      
      Accept your invitation: ${data.inviteUrl}
      
      This invitation expires on ${expiryDate}.
      
      If you have questions, contact ${data.inviterName} or visit our help center.
    `

    return {
      subject: `Invitation to join "${data.projectName}" on Saga`,
      html,
      text
    }
  }

  /**
   * 生成通知邮件模板
   */
  private static generateNotificationTemplate(data: NotificationEmailData): EmailTemplate {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎭 Saga</h1>
          </div>
          
          <div class="content">
            <h2>${data.title}</h2>
            <p>Hello ${data.recipientName},</p>
            <p>${data.message}</p>
            
            ${data.actionUrl ? `
              <div style="text-align: center;">
                <a href="${data.actionUrl}" class="button">View Details</a>
              </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>This notification was sent by Saga Family Biography Platform.</p>
            <p><a href="https://saga.family">Visit Saga</a> | <a href="https://saga.family/help">Help Center</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `
      ${data.title}
      
      Hello ${data.recipientName},
      
      ${data.message}
      
      ${data.actionUrl ? `View details: ${data.actionUrl}` : ''}
    `

    return {
      subject: data.title,
      html,
      text
    }
  }
}
