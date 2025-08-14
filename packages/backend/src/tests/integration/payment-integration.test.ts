import request from 'supertest';
import { app } from '../../index';
import { setupTestDatabase, cleanupTestDatabase, createTestUser } from '../setup';
import { generateAccessToken } from '../../services/auth-service';
import { SubscriptionService } from '../../services/subscription-service';
import { knex } from '../../config/database';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn(),
    },
    paymentMethods: {
      attach: jest.fn(),
      detach: jest.fn(),
      list: jest.fn(),
    },
    invoices: {
      retrieve: jest.fn(),
      list: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
    prices: {
      list: jest.fn(),
    },
  }));
});

describe('Payment Integration Tests', () => {
  let testUserId: string;
  let authToken: string;
  let subscriptionService: SubscriptionService;
  let mockStripe: any;

  beforeAll(async () => {
    await setupTestDatabase();
    subscriptionService = new SubscriptionService();
    mockStripe = require('stripe')();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Create test user for each test
    const testUser = await createTestUser({
      email: 'payment-test@example.com',
      name: 'Payment Test User',
      password: 'TestPassword123!',
    });
    testUserId = testUser.id;
    authToken = generateAccessToken(testUser);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up subscriptions after each test
    await knex('subscriptions').where('user_id', testUserId).del();
  });

  describe('Subscription Creation Flow', () => {
    it('should create a new subscription successfully', async () => {
      // Mock Stripe customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_mock123',
        email: 'payment-test@example.com',
        name: 'Payment Test User',
      });

      // Mock Stripe subscription creation
      mockStripe.subscriptions.create.mockResolvedValue({
        id: 'sub_mock123',
        status: 'active',
        customer: 'cus_mock123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 31536000, // 1 year
        items: {
          data: [{
            price: {
              id: 'price_saga_package',
              unit_amount: 12900,
              currency: 'usd',
              recurring: {
                interval: 'year',
              },
            },
          }],
        },
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'saga-package',
          paymentMethodId: 'pm_mock123',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.planId).toBe('saga-package');

      // Verify Stripe calls
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'payment-test@example.com',
        name: 'Payment Test User',
        payment_method: 'pm_mock123',
        invoice_settings: {
          default_payment_method: 'pm_mock123',
        },
      });

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_mock123',
        items: [{ price: 'price_saga_package' }],
        default_payment_method: 'pm_mock123',
        expand: ['latest_invoice.payment_intent'],
      });

      // Verify database record
      const dbSubscription = await knex('subscriptions')
        .where('user_id', testUserId)
        .first();
      
      expect(dbSubscription).toBeDefined();
      expect(dbSubscription.stripe_subscription_id).toBe('sub_mock123');
      expect(dbSubscription.status).toBe('active');
    });

    it('should handle payment method attachment during subscription creation', async () => {
      // Mock customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_mock123',
        email: 'payment-test@example.com',
      });

      // Mock payment method attachment
      mockStripe.paymentMethods.attach.mockResolvedValue({
        id: 'pm_mock123',
        customer: 'cus_mock123',
      });

      // Mock subscription creation
      mockStripe.subscriptions.create.mockResolvedValue({
        id: 'sub_mock123',
        status: 'active',
        customer: 'cus_mock123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 31536000,
        items: {
          data: [{
            price: {
              id: 'price_saga_package',
              unit_amount: 12900,
              currency: 'usd',
            },
          }],
        },
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'saga-package',
          paymentMethodId: 'pm_mock123',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith('pm_mock123', {
        customer: 'cus_mock123',
      });
    });

    it('should handle subscription creation with trial period', async () => {
      // Mock customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_mock123',
        email: 'payment-test@example.com',
      });

      // Mock subscription creation with trial
      const trialEnd = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
      mockStripe.subscriptions.create.mockResolvedValue({
        id: 'sub_mock123',
        status: 'trialing',
        customer: 'cus_mock123',
        trial_end: trialEnd,
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: trialEnd,
        items: {
          data: [{
            price: {
              id: 'price_saga_package_trial',
              unit_amount: 12900,
              currency: 'usd',
            },
          }],
        },
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'saga-package-trial',
          paymentMethodId: 'pm_mock123',
          trialDays: 7,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('trialing');
      expect(response.body.data.trialEnd).toBeDefined();

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          trial_period_days: 7,
        })
      );
    });
  });

  describe('Subscription Management', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      // Create a test subscription in the database
      const [subscription] = await knex('subscriptions')
        .insert({
          user_id: testUserId,
          stripe_customer_id: 'cus_mock123',
          stripe_subscription_id: 'sub_mock123',
          plan_id: 'saga-package',
          status: 'active',
          current_period_start: new Date(),
          current_period_end: new Date(Date.now() + 31536000000), // 1 year
        })
        .returning('id');
      
      subscriptionId = subscription.id;
    });

    it('should retrieve subscription details', async () => {
      // Mock Stripe subscription retrieval
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_mock123',
        status: 'active',
        customer: 'cus_mock123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 31536000,
        items: {
          data: [{
            price: {
              id: 'price_saga_package',
              unit_amount: 12900,
              currency: 'usd',
            },
          }],
        },
      });

      const response = await request(app)
        .get(`/api/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(subscriptionId);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.planId).toBe('saga-package');
    });

    it('should update subscription plan', async () => {
      // Mock Stripe subscription update
      mockStripe.subscriptions.update.mockResolvedValue({
        id: 'sub_mock123',
        status: 'active',
        customer: 'cus_mock123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 31536000,
        items: {
          data: [{
            price: {
              id: 'price_saga_package_premium',
              unit_amount: 19900,
              currency: 'usd',
            },
          }],
        },
      });

      const response = await request(app)
        .put(`/api/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'saga-package-premium',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.planId).toBe('saga-package-premium');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_mock123', {
        items: [{
          id: expect.any(String),
          price: 'price_saga_package_premium',
        }],
        proration_behavior: 'always_invoice',
      });
    });

    it('should update payment method', async () => {
      // Mock payment method attachment
      mockStripe.paymentMethods.attach.mockResolvedValue({
        id: 'pm_new123',
        customer: 'cus_mock123',
      });

      // Mock subscription update
      mockStripe.subscriptions.update.mockResolvedValue({
        id: 'sub_mock123',
        status: 'active',
        default_payment_method: 'pm_new123',
      });

      const response = await request(app)
        .put(`/api/subscriptions/${subscriptionId}/payment-method`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethodId: 'pm_new123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith('pm_new123', {
        customer: 'cus_mock123',
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_mock123', {
        default_payment_method: 'pm_new123',
      });
    });

    it('should cancel subscription', async () => {
      // Mock Stripe subscription cancellation
      mockStripe.subscriptions.cancel.mockResolvedValue({
        id: 'sub_mock123',
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
      });

      const response = await request(app)
        .delete(`/api/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('canceled');

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_mock123');

      // Verify database update
      const dbSubscription = await knex('subscriptions')
        .where('id', subscriptionId)
        .first();
      
      expect(dbSubscription.status).toBe('canceled');
    });

    it('should schedule subscription cancellation at period end', async () => {
      // Mock Stripe subscription update for cancellation at period end
      mockStripe.subscriptions.update.mockResolvedValue({
        id: 'sub_mock123',
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 31536000,
      });

      const response = await request(app)
        .put(`/api/subscriptions/${subscriptionId}/cancel-at-period-end`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cancelAtPeriodEnd).toBe(true);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_mock123', {
        cancel_at_period_end: true,
      });
    });
  });

  describe('Webhook Processing', () => {
    it('should process invoice.payment_succeeded webhook', async () => {
      // Mock webhook event construction
      const mockEvent = {
        id: 'evt_mock123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_mock123',
            subscription: 'sub_mock123',
            amount_paid: 12900,
            status: 'paid',
            customer: 'cus_mock123',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Create subscription in database
      await knex('subscriptions').insert({
        user_id: testUserId,
        stripe_customer_id: 'cus_mock123',
        stripe_subscription_id: 'sub_mock123',
        plan_id: 'saga-package',
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 31536000000),
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'mock-signature')
        .send(JSON.stringify(mockEvent))
        .expect(200);

      expect(response.body.received).toBe(true);

      // Verify webhook was processed
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        JSON.stringify(mockEvent),
        'mock-signature',
        expect.any(String)
      );
    });

    it('should process invoice.payment_failed webhook', async () => {
      const mockEvent = {
        id: 'evt_mock124',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_mock124',
            subscription: 'sub_mock123',
            amount_due: 12900,
            status: 'open',
            customer: 'cus_mock123',
            attempt_count: 1,
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Create subscription in database
      await knex('subscriptions').insert({
        user_id: testUserId,
        stripe_customer_id: 'cus_mock123',
        stripe_subscription_id: 'sub_mock123',
        plan_id: 'saga-package',
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 31536000000),
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'mock-signature')
        .send(JSON.stringify(mockEvent))
        .expect(200);

      expect(response.body.received).toBe(true);

      // Verify subscription status was updated
      const subscription = await knex('subscriptions')
        .where('stripe_subscription_id', 'sub_mock123')
        .first();
      
      expect(subscription.status).toBe('past_due');
    });

    it('should process customer.subscription.deleted webhook', async () => {
      const mockEvent = {
        id: 'evt_mock125',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_mock123',
            customer: 'cus_mock123',
            status: 'canceled',
            canceled_at: Math.floor(Date.now() / 1000),
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Create subscription in database
      await knex('subscriptions').insert({
        user_id: testUserId,
        stripe_customer_id: 'cus_mock123',
        stripe_subscription_id: 'sub_mock123',
        plan_id: 'saga-package',
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 31536000000),
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'mock-signature')
        .send(JSON.stringify(mockEvent))
        .expect(200);

      expect(response.body.received).toBe(true);

      // Verify subscription was marked as canceled
      const subscription = await knex('subscriptions')
        .where('stripe_subscription_id', 'sub_mock123')
        .first();
      
      expect(subscription.status).toBe('canceled');
    });

    it('should handle invalid webhook signatures', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid-signature')
        .send('{"type": "test"}')
        .expect(400);
    });

    it('should handle unknown webhook events gracefully', async () => {
      const mockEvent = {
        id: 'evt_mock126',
        type: 'unknown.event.type',
        data: {
          object: {},
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'mock-signature')
        .send(JSON.stringify(mockEvent))
        .expect(200);

      expect(response.body.received).toBe(true);
    });
  });

  describe('Payment Error Handling', () => {
    it('should handle card declined errors', async () => {
      // Mock customer creation success
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_mock123',
        email: 'payment-test@example.com',
      });

      // Mock subscription creation failure
      mockStripe.subscriptions.create.mockRejectedValue({
        type: 'StripeCardError',
        code: 'card_declined',
        message: 'Your card was declined.',
        decline_code: 'generic_decline',
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'saga-package',
          paymentMethodId: 'pm_declined123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAYMENT_DECLINED');
      expect(response.body.error.message).toContain('card was declined');
    });

    it('should handle insufficient funds errors', async () => {
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_mock123',
        email: 'payment-test@example.com',
      });

      mockStripe.subscriptions.create.mockRejectedValue({
        type: 'StripeCardError',
        code: 'card_declined',
        decline_code: 'insufficient_funds',
        message: 'Your card has insufficient funds.',
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'saga-package',
          paymentMethodId: 'pm_insufficient123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INSUFFICIENT_FUNDS');
    });

    it('should handle expired card errors', async () => {
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_mock123',
        email: 'payment-test@example.com',
      });

      mockStripe.subscriptions.create.mockRejectedValue({
        type: 'StripeCardError',
        code: 'expired_card',
        message: 'Your card has expired.',
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'saga-package',
          paymentMethodId: 'pm_expired123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('CARD_EXPIRED');
    });

    it('should handle Stripe service errors', async () => {
      mockStripe.customers.create.mockRejectedValue({
        type: 'StripeAPIError',
        message: 'Stripe service temporarily unavailable',
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: 'saga-package',
          paymentMethodId: 'pm_mock123',
        })
        .expect(503);

      expect(response.body.error.code).toBe('PAYMENT_SERVICE_ERROR');
    });
  });

  describe('Billing and Invoicing', () => {
    it('should retrieve customer invoices', async () => {
      // Create subscription with customer
      await knex('subscriptions').insert({
        user_id: testUserId,
        stripe_customer_id: 'cus_mock123',
        stripe_subscription_id: 'sub_mock123',
        plan_id: 'saga-package',
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 31536000000),
      });

      // Mock Stripe invoice list
      mockStripe.invoices.list.mockResolvedValue({
        data: [
          {
            id: 'in_mock123',
            amount_paid: 12900,
            amount_due: 0,
            status: 'paid',
            created: Math.floor(Date.now() / 1000),
            invoice_pdf: 'https://pay.stripe.com/invoice/123/pdf',
          },
          {
            id: 'in_mock124',
            amount_paid: 12900,
            amount_due: 0,
            status: 'paid',
            created: Math.floor(Date.now() / 1000) - 31536000,
            invoice_pdf: 'https://pay.stripe.com/invoice/124/pdf',
          },
        ],
      });

      const response = await request(app)
        .get('/api/billing/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data[0].id).toBe('in_mock123');
      expect(response.body.data[0].status).toBe('paid');

      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_mock123',
        limit: 100,
      });
    });

    it('should retrieve specific invoice details', async () => {
      // Create subscription
      await knex('subscriptions').insert({
        user_id: testUserId,
        stripe_customer_id: 'cus_mock123',
        stripe_subscription_id: 'sub_mock123',
        plan_id: 'saga-package',
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 31536000000),
      });

      // Mock Stripe invoice retrieval
      mockStripe.invoices.retrieve.mockResolvedValue({
        id: 'in_mock123',
        amount_paid: 12900,
        amount_due: 0,
        status: 'paid',
        created: Math.floor(Date.now() / 1000),
        invoice_pdf: 'https://pay.stripe.com/invoice/123/pdf',
        lines: {
          data: [
            {
              description: 'Saga Family Biography Package',
              amount: 12900,
              currency: 'usd',
            },
          ],
        },
      });

      const response = await request(app)
        .get('/api/billing/invoices/in_mock123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('in_mock123');
      expect(response.body.data.amount_paid).toBe(12900);
      expect(response.body.data.lines.data.length).toBe(1);
    });

    it('should prevent access to other users invoices', async () => {
      // Create another user's subscription
      const otherUser = await createTestUser({
        email: 'other-user@example.com',
        name: 'Other User',
        password: 'OtherPassword123!',
      });

      await knex('subscriptions').insert({
        user_id: otherUser.id,
        stripe_customer_id: 'cus_other123',
        stripe_subscription_id: 'sub_other123',
        plan_id: 'saga-package',
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 31536000000),
      });

      // Mock invoice that belongs to other user
      mockStripe.invoices.retrieve.mockResolvedValue({
        id: 'in_other123',
        customer: 'cus_other123',
        amount_paid: 12900,
        status: 'paid',
      });

      await request(app)
        .get('/api/billing/invoices/in_other123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('Subscription Analytics', () => {
    it('should provide subscription metrics', async () => {
      // Create multiple subscriptions for analytics
      await knex('subscriptions').insert([
        {
          user_id: testUserId,
          stripe_customer_id: 'cus_mock123',
          stripe_subscription_id: 'sub_mock123',
          plan_id: 'saga-package',
          status: 'active',
          current_period_start: new Date(),
          current_period_end: new Date(Date.now() + 31536000000),
          created_at: new Date(),
        },
      ]);

      const response = await request(app)
        .get('/api/admin/subscription-metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalSubscriptions).toBeGreaterThan(0);
      expect(response.body.data.activeSubscriptions).toBeGreaterThan(0);
      expect(response.body.data.monthlyRecurringRevenue).toBeGreaterThan(0);
    });
  });
});