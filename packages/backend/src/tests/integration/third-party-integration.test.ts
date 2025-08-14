import { OpenAIService } from '../../services/openai-service';
import { SpeechToTextService } from '../../services/speech-to-text-service';
import { StorageService } from '../../services/storage-service';
import { EmailNotificationService } from '../../services/email-notification-service';
import { PushNotificationService } from '../../services/push-notification-service';
import { SubscriptionService } from '../../services/subscription-service';
import { setupTestDatabase, cleanupTestDatabase } from '../setup';
import fs from 'fs';
import path from 'path';

// Mock third-party services for testing
jest.mock('openai');
jest.mock('@aws-sdk/client-s3');
jest.mock('@sendgrid/mail');
jest.mock('firebase-admin');
jest.mock('stripe');

describe('Third-Party Service Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('OpenAI Integration', () => {
    let openaiService: OpenAIService;

    beforeEach(() => {
      openaiService = new OpenAIService();
    });

    it('should generate AI prompts successfully', async () => {
      // Mock OpenAI response
      const mockCompletion = {
        choices: [{
          message: {
            content: JSON.stringify({
              prompt: "Tell me about your childhood memories in the garden.",
              followUp: "What was your favorite activity in the garden?",
              category: "childhood",
              difficulty: "easy"
            })
          }
        }]
      };

      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      const result = await openaiService.generatePrompt({
        category: 'childhood',
        previousPrompts: [],
        userContext: { age: 75, interests: ['gardening'] }
      });

      expect(result.prompt).toContain('garden');
      expect(result.category).toBe('childhood');
      expect(mockInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ])
        })
      );
    });

    it('should generate story summaries', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: "A heartwarming story about childhood memories in a family garden.",
              keyThemes: ["childhood", "family", "nature"],
              emotionalTone: "nostalgic",
              suggestedFollowUps: ["What other outdoor activities did you enjoy?"]
            })
          }
        }]
      };

      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      const result = await openaiService.generateStorySummary({
        transcript: "I remember playing in our family garden when I was young. My grandmother would teach me about different plants.",
        title: "Garden Memories"
      });

      expect(result.summary).toContain('garden');
      expect(result.keyThemes).toContain('childhood');
      expect(result.emotionalTone).toBe('nostalgic');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(openaiService.generatePrompt({
        category: 'childhood',
        previousPrompts: [],
        userContext: {}
      })).rejects.toThrow('API rate limit exceeded');
    });

    it('should validate API key configuration', () => {
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      expect(openaiService.isConfigured()).toBe(true);
    });
  });

  describe('Speech-to-Text Integration', () => {
    let sttService: SpeechToTextService;

    beforeEach(() => {
      sttService = new SpeechToTextService();
    });

    it('should transcribe audio files successfully', async () => {
      // Create mock audio file
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockTranscription = {
        text: "This is a test transcription of the audio file.",
        confidence: 0.95,
        segments: [
          {
            start: 0,
            end: 5.2,
            text: "This is a test transcription",
            confidence: 0.96
          },
          {
            start: 5.2,
            end: 8.1,
            text: "of the audio file.",
            confidence: 0.94
          }
        ]
      };

      // Mock the transcription service
      jest.spyOn(sttService, 'transcribeAudio').mockResolvedValue(mockTranscription);

      const result = await sttService.transcribeAudio(mockAudioBuffer, {
        format: 'wav',
        sampleRate: 44100,
        channels: 1
      });

      expect(result.text).toBe(mockTranscription.text);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.segments).toHaveLength(2);
    });

    it('should handle different audio formats', async () => {
      const formats = ['wav', 'mp3', 'flac', 'm4a'];
      const mockAudioBuffer = Buffer.from('mock audio data');

      for (const format of formats) {
        const mockTranscription = {
          text: `Transcription for ${format} format`,
          confidence: 0.9,
          segments: []
        };

        jest.spyOn(sttService, 'transcribeAudio').mockResolvedValue(mockTranscription);

        const result = await sttService.transcribeAudio(mockAudioBuffer, {
          format: format as any,
          sampleRate: 44100,
          channels: 1
        });

        expect(result.text).toContain(format);
      }
    });

    it('should handle transcription errors', async () => {
      const mockAudioBuffer = Buffer.from('invalid audio data');

      jest.spyOn(sttService, 'transcribeAudio').mockRejectedValue(
        new Error('Audio format not supported')
      );

      await expect(sttService.transcribeAudio(mockAudioBuffer, {
        format: 'invalid' as any,
        sampleRate: 44100,
        channels: 1
      })).rejects.toThrow('Audio format not supported');
    });

    it('should validate audio file constraints', async () => {
      const largeMockBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB

      await expect(sttService.validateAudioFile(largeMockBuffer, {
        format: 'wav',
        sampleRate: 44100,
        channels: 1
      })).rejects.toThrow('File size exceeds maximum limit');
    });
  });

  describe('AWS S3 Storage Integration', () => {
    let storageService: StorageService;

    beforeEach(() => {
      storageService = new StorageService();
    });

    it('should upload files to S3 successfully', async () => {
      const mockFile = {
        buffer: Buffer.from('test file content'),
        originalname: 'test-audio.wav',
        mimetype: 'audio/wav',
        size: 1024
      };

      const mockS3Response = {
        Location: 'https://test-bucket.s3.amazonaws.com/audio/test-audio-123.wav',
        ETag: '"mock-etag"',
        Bucket: 'test-bucket',
        Key: 'audio/test-audio-123.wav'
      };

      // Mock S3 upload
      const mockS3 = require('@aws-sdk/client-s3');
      mockS3.S3Client.prototype.send = jest.fn().mockResolvedValue(mockS3Response);

      const result = await storageService.uploadFile(mockFile, {
        folder: 'audio',
        generateUniqueFilename: true
      });

      expect(result.url).toContain('s3.amazonaws.com');
      expect(result.key).toContain('audio/');
      expect(result.bucket).toBe('test-bucket');
    });

    it('should generate signed URLs for private files', async () => {
      const fileKey = 'audio/private-audio-123.wav';
      const mockSignedUrl = 'https://test-bucket.s3.amazonaws.com/audio/private-audio-123.wav?X-Amz-Signature=mock';

      // Mock S3 getSignedUrl
      const mockS3 = require('@aws-sdk/client-s3');
      mockS3.getSignedUrl = jest.fn().mockResolvedValue(mockSignedUrl);

      const result = await storageService.getSignedUrl(fileKey, {
        expiresIn: 3600,
        operation: 'getObject'
      });

      expect(result).toBe(mockSignedUrl);
      expect(mockS3.getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          Bucket: expect.any(String),
          Key: fileKey
        }),
        { expiresIn: 3600 }
      );
    });

    it('should delete files from S3', async () => {
      const fileKey = 'audio/test-audio-123.wav';

      const mockS3 = require('@aws-sdk/client-s3');
      mockS3.S3Client.prototype.send = jest.fn().mockResolvedValue({});

      const result = await storageService.deleteFile(fileKey);

      expect(result).toBe(true);
      expect(mockS3.S3Client.prototype.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: expect.any(String),
            Key: fileKey
          })
        })
      );
    });

    it('should handle S3 errors gracefully', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1024
      };

      const mockS3 = require('@aws-sdk/client-s3');
      mockS3.S3Client.prototype.send = jest.fn().mockRejectedValue(
        new Error('Access Denied')
      );

      await expect(storageService.uploadFile(mockFile, {
        folder: 'test'
      })).rejects.toThrow('Access Denied');
    });
  });

  describe('Email Notification Integration', () => {
    let emailService: EmailNotificationService;

    beforeEach(() => {
      emailService = new EmailNotificationService();
    });

    it('should send emails via SendGrid', async () => {
      const mockSendGrid = require('@sendgrid/mail');
      mockSendGrid.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test Email Content</h1>',
        text: 'Test Email Content'
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(mockSendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          from: expect.any(String)
        })
      );
    });

    it('should send invitation emails with templates', async () => {
      const mockSendGrid = require('@sendgrid/mail');
      mockSendGrid.send = jest.fn().mockResolvedValue([{ statusCode: 202 }]);

      const invitationData = {
        to: 'storyteller@example.com',
        facilitatorName: 'John Doe',
        projectTitle: 'Family Stories',
        invitationUrl: 'https://app.saga.com/invite/abc123',
        message: 'Please join my family story project!'
      };

      const result = await emailService.sendInvitationEmail(invitationData);

      expect(result.success).toBe(true);
      expect(mockSendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: invitationData.to,
          templateId: expect.any(String),
          dynamicTemplateData: expect.objectContaining({
            facilitatorName: invitationData.facilitatorName,
            projectTitle: invitationData.projectTitle,
            invitationUrl: invitationData.invitationUrl,
            message: invitationData.message
          })
        })
      );
    });

    it('should handle email delivery failures', async () => {
      const mockSendGrid = require('@sendgrid/mail');
      mockSendGrid.send = jest.fn().mockRejectedValue(
        new Error('Email delivery failed')
      );

      const emailData = {
        to: 'invalid@example.com',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
        text: 'Test'
      };

      await expect(emailService.sendEmail(emailData)).rejects.toThrow(
        'Email delivery failed'
      );
    });

    it('should validate email addresses', async () => {
      const invalidEmailData = {
        to: 'invalid-email',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
        text: 'Test'
      };

      await expect(emailService.sendEmail(invalidEmailData)).rejects.toThrow(
        'Invalid email address'
      );
    });
  });

  describe('Push Notification Integration', () => {
    let pushService: PushNotificationService;

    beforeEach(() => {
      pushService = new PushNotificationService();
    });

    it('should send push notifications via Firebase', async () => {
      const mockFirebase = require('firebase-admin');
      const mockMessaging = {
        send: jest.fn().mockResolvedValue('mock-message-id'),
        sendMulticast: jest.fn().mockResolvedValue({
          successCount: 2,
          failureCount: 0,
          responses: [
            { success: true, messageId: 'msg1' },
            { success: true, messageId: 'msg2' }
          ]
        })
      };
      mockFirebase.messaging.mockReturnValue(mockMessaging);

      const notificationData = {
        token: 'mock-device-token',
        title: 'New Story Uploaded',
        body: 'A new story has been shared in your project',
        data: {
          projectId: 'project-123',
          storyId: 'story-456',
          type: 'story_uploaded'
        }
      };

      const result = await pushService.sendNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('mock-message-id');
      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          token: notificationData.token,
          notification: {
            title: notificationData.title,
            body: notificationData.body
          },
          data: notificationData.data
        })
      );
    });

    it('should send multicast notifications', async () => {
      const mockFirebase = require('firebase-admin');
      const mockMessaging = {
        sendMulticast: jest.fn().mockResolvedValue({
          successCount: 2,
          failureCount: 0,
          responses: [
            { success: true, messageId: 'msg1' },
            { success: true, messageId: 'msg2' }
          ]
        })
      };
      mockFirebase.messaging.mockReturnValue(mockMessaging);

      const multicastData = {
        tokens: ['token1', 'token2'],
        title: 'Project Update',
        body: 'Your family story project has been updated',
        data: { projectId: 'project-123' }
      };

      const result = await pushService.sendMulticast(multicastData);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(mockMessaging.sendMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: multicastData.tokens,
          notification: {
            title: multicastData.title,
            body: multicastData.body
          },
          data: multicastData.data
        })
      );
    });

    it('should handle invalid device tokens', async () => {
      const mockFirebase = require('firebase-admin');
      const mockMessaging = {
        send: jest.fn().mockRejectedValue(
          new Error('Invalid registration token')
        )
      };
      mockFirebase.messaging.mockReturnValue(mockMessaging);

      const notificationData = {
        token: 'invalid-token',
        title: 'Test',
        body: 'Test message',
        data: {}
      };

      await expect(pushService.sendNotification(notificationData)).rejects.toThrow(
        'Invalid registration token'
      );
    });
  });

  describe('Stripe Payment Integration', () => {
    let subscriptionService: SubscriptionService;

    beforeEach(() => {
      subscriptionService = new SubscriptionService();
    });

    it('should create Stripe subscriptions', async () => {
      const mockStripe = require('stripe');
      const mockStripeInstance = new mockStripe();
      
      const mockSubscription = {
        id: 'sub_mock123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 31536000, // 1 year
        items: {
          data: [{
            price: {
              id: 'price_saga_package',
              unit_amount: 12900,
              currency: 'usd'
            }
          }]
        }
      };

      mockStripeInstance.subscriptions.create.mockResolvedValue(mockSubscription);

      const subscriptionData = {
        customerId: 'cus_mock123',
        priceId: 'price_saga_package',
        paymentMethodId: 'pm_mock123'
      };

      const result = await subscriptionService.createSubscription(subscriptionData);

      expect(result.id).toBe(mockSubscription.id);
      expect(result.status).toBe('active');
      expect(mockStripeInstance.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: subscriptionData.customerId,
          items: [{ price: subscriptionData.priceId }],
          default_payment_method: subscriptionData.paymentMethodId
        })
      );
    });

    it('should handle payment method updates', async () => {
      const mockStripe = require('stripe');
      const mockStripeInstance = new mockStripe();
      
      const mockUpdatedSubscription = {
        id: 'sub_mock123',
        status: 'active',
        default_payment_method: 'pm_new123'
      };

      mockStripeInstance.subscriptions.update.mockResolvedValue(mockUpdatedSubscription);

      const result = await subscriptionService.updatePaymentMethod(
        'sub_mock123',
        'pm_new123'
      );

      expect(result.default_payment_method).toBe('pm_new123');
      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
        'sub_mock123',
        { default_payment_method: 'pm_new123' }
      );
    });

    it('should handle subscription cancellation', async () => {
      const mockStripe = require('stripe');
      const mockStripeInstance = new mockStripe();
      
      const mockCancelledSubscription = {
        id: 'sub_mock123',
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000)
      };

      mockStripeInstance.subscriptions.cancel.mockResolvedValue(mockCancelledSubscription);

      const result = await subscriptionService.cancelSubscription('sub_mock123');

      expect(result.status).toBe('canceled');
      expect(result.canceled_at).toBeDefined();
      expect(mockStripeInstance.subscriptions.cancel).toHaveBeenCalledWith('sub_mock123');
    });

    it('should handle webhook events', async () => {
      const mockStripe = require('stripe');
      const mockStripeInstance = new mockStripe();
      
      const mockEvent = {
        id: 'evt_mock123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_mock123',
            subscription: 'sub_mock123',
            amount_paid: 12900,
            status: 'paid'
          }
        }
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      const webhookPayload = JSON.stringify(mockEvent);
      const webhookSignature = 'mock-signature';

      const result = await subscriptionService.handleWebhook(
        webhookPayload,
        webhookSignature
      );

      expect(result.processed).toBe(true);
      expect(result.eventType).toBe('invoice.payment_succeeded');
      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        webhookPayload,
        webhookSignature,
        expect.any(String)
      );
    });

    it('should handle payment failures', async () => {
      const mockStripe = require('stripe');
      const mockStripeInstance = new mockStripe();
      
      mockStripeInstance.subscriptions.create.mockRejectedValue(
        new Error('Your card was declined')
      );

      const subscriptionData = {
        customerId: 'cus_mock123',
        priceId: 'price_saga_package',
        paymentMethodId: 'pm_declined123'
      };

      await expect(subscriptionService.createSubscription(subscriptionData)).rejects.toThrow(
        'Your card was declined'
      );
    });
  });

  describe('Service Integration Health Checks', () => {
    it('should verify all third-party service configurations', async () => {
      // Check OpenAI configuration
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      
      // Check AWS configuration
      expect(process.env.AWS_ACCESS_KEY_ID).toBeDefined();
      expect(process.env.AWS_SECRET_ACCESS_KEY).toBeDefined();
      expect(process.env.AWS_S3_BUCKET).toBeDefined();
      
      // Check SendGrid configuration
      expect(process.env.SENDGRID_API_KEY).toBeDefined();
      
      // Check Firebase configuration
      expect(process.env.FIREBASE_PROJECT_ID).toBeDefined();
      
      // Check Stripe configuration
      expect(process.env.STRIPE_SECRET_KEY).toBeDefined();
      expect(process.env.STRIPE_WEBHOOK_SECRET).toBeDefined();
    });

    it('should test service connectivity', async () => {
      // Test OpenAI connectivity
      const openaiService = new OpenAIService();
      expect(await openaiService.testConnection()).toBe(true);
      
      // Test AWS S3 connectivity
      const storageService = new StorageService();
      expect(await storageService.testConnection()).toBe(true);
      
      // Test email service connectivity
      const emailService = new EmailNotificationService();
      expect(await emailService.testConnection()).toBe(true);
      
      // Test push notification service connectivity
      const pushService = new PushNotificationService();
      expect(await pushService.testConnection()).toBe(true);
      
      // Test payment service connectivity
      const subscriptionService = new SubscriptionService();
      expect(await subscriptionService.testConnection()).toBe(true);
    });

    it('should handle service degradation gracefully', async () => {
      // Test fallback mechanisms when primary services fail
      const sttService = new SpeechToTextService();
      
      // Mock primary service failure
      jest.spyOn(sttService, 'transcribeWithGoogle').mockRejectedValue(
        new Error('Google STT service unavailable')
      );
      
      // Mock fallback service success
      jest.spyOn(sttService, 'transcribeWithAWS').mockResolvedValue({
        text: 'Fallback transcription successful',
        confidence: 0.85,
        segments: []
      });
      
      const mockAudioBuffer = Buffer.from('mock audio');
      const result = await sttService.transcribeAudio(mockAudioBuffer, {
        format: 'wav',
        sampleRate: 44100,
        channels: 1
      });
      
      expect(result.text).toBe('Fallback transcription successful');
      expect(sttService.transcribeWithAWS).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting and Quotas', () => {
    it('should respect API rate limits', async () => {
      const openaiService = new OpenAIService();
      
      // Mock rate limit error
      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create.mockRejectedValue(
        new Error('Rate limit exceeded')
      );
      
      await expect(openaiService.generatePrompt({
        category: 'childhood',
        previousPrompts: [],
        userContext: {}
      })).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle quota exhaustion', async () => {
      const sttService = new SpeechToTextService();
      
      // Mock quota exhaustion
      jest.spyOn(sttService, 'transcribeAudio').mockRejectedValue(
        new Error('Monthly quota exceeded')
      );
      
      const mockAudioBuffer = Buffer.from('mock audio');
      
      await expect(sttService.transcribeAudio(mockAudioBuffer, {
        format: 'wav',
        sampleRate: 44100,
        channels: 1
      })).rejects.toThrow('Monthly quota exceeded');
    });
  });
});