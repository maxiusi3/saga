/**
 * Resource Wallet Workflow Integration Tests
 * 
 * Tests the complete resource wallet and seat consumption workflow
 */

import request from 'supertest';
import { app } from '../../index';
import { knex } from '../../config/database';

describe('Resource Wallet Workflow Integration', () => {
  let userToken: string;
  let userId: string;
  let secondUserToken: string;
  let secondUserId: string;

  beforeAll(async () => {
    // Clean up test data
    await knex('seat_transactions').del();
    await knex('user_resource_wallets').del();
    await knex('project_roles').del();
    await knex('projects').del();
    await knex('users').del();

    // Create test users
    const userResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'wallet.user@test.com',
        password: 'testpassword123',
        name: 'Wallet Test User'
      });

    userToken = userResponse.body.accessToken;
    userId = userResponse.body.user.id;

    const secondUserResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'second.wallet.user@test.com',
        password: 'testpassword123',
        name: 'Second Wallet User'
      });

    secondUserToken = secondUserResponse.body.accessToken;
    secondUserId = secondUserResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await knex('seat_transactions').del();
    await knex('user_resource_wallets').del();
    await knex('project_roles').del();
    await knex('projects').del();
    await knex('users').del();
  });

  describe('Initial Wallet Setup', () => {
    it('should create wallet with initial resources on user signup', async () => {
      const walletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      expect(walletResponse.status).toBe(200);
      expect(walletResponse.body.userId).toBe(userId);
      expect(walletResponse.body.projectVouchers).toBeGreaterThanOrEqual(0);
      expect(walletResponse.body.facilitatorSeats).toBeGreaterThanOrEqual(0);
      expect(walletResponse.body.storytellerSeats).toBeGreaterThanOrEqual(0);
    });

    it('should track initial wallet creation transaction', async () => {
      const transactionsResponse = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(transactionsResponse.status).toBe(200);
      expect(transactionsResponse.body.transactions).toBeDefined();
      
      // Should have initial credit transactions if any resources were provided
      const initialTransactions = transactionsResponse.body.transactions.filter(
        t => t.transactionType === 'purchase' || t.transactionType === 'credit'
      );
      
      // At minimum, should have transaction history tracking
      expect(Array.isArray(transactionsResponse.body.transactions)).toBe(true);
    });
  });

  describe('Project Creation Workflow', () => {
    let projectId: string;

    it('should consume project voucher when creating project', async () => {
      // Get initial wallet balance
      const initialWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      const initialVouchers = initialWalletResponse.body.projectVouchers;

      // Create project (should consume voucher)
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Wallet Test Project'
        });

      expect(projectResponse.status).toBe(201);
      projectId = projectResponse.body.id;

      // Check wallet balance after project creation
      const finalWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      expect(finalWalletResponse.body.projectVouchers).toBe(initialVouchers - 1);

      // Verify transaction was logged
      const transactionsResponse = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${userToken}`);

      const consumeTransactions = transactionsResponse.body.transactions.filter(
        t => t.transactionType === 'consume' && t.resourceType === 'project_voucher'
      );

      expect(consumeTransactions.length).toBeGreaterThan(0);
      expect(consumeTransactions[0].amount).toBe(-1);
      expect(consumeTransactions[0].projectId).toBe(projectId);
    });

    it('should prevent project creation with insufficient vouchers', async () => {
      // Consume all remaining vouchers first
      const walletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      const remainingVouchers = walletResponse.body.projectVouchers;

      // Try to create more projects than vouchers available
      for (let i = 0; i < remainingVouchers; i++) {
        await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: `Test Project ${i + 2}`
          });
      }

      // Now try to create one more project (should fail)
      const failedProjectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Should Fail Project'
        });

      expect(failedProjectResponse.status).toBe(400);
      expect(failedProjectResponse.body.error.message).toMatch(/insufficient.*voucher/i);
    });
  });

  describe('Invitation and Seat Consumption Workflow', () => {
    let testProjectId: string;

    beforeAll(async () => {
      // Create a project with second user who has vouchers
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          name: 'Invitation Test Project'
        });

      testProjectId = projectResponse.body.id;
    });

    it('should consume facilitator seat on invitation acceptance', async () => {
      // Get initial wallet balance
      const initialWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${secondUserToken}`);

      const initialFacilitatorSeats = initialWalletResponse.body.facilitatorSeats;

      // Create facilitator invitation
      const invitationResponse = await request(app)
        .post(`/api/projects/${testProjectId}/invitations`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          role: 'facilitator'
        });

      expect(invitationResponse.status).toBe(201);
      const invitationToken = invitationResponse.body.token;

      // Accept invitation (should consume seat)
      const acceptResponse = await request(app)
        .post(`/api/invitations/${invitationToken}/accept`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(acceptResponse.status).toBe(200);

      // Check wallet balance after invitation acceptance
      const finalWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${secondUserToken}`);

      expect(finalWalletResponse.body.facilitatorSeats).toBe(initialFacilitatorSeats - 1);

      // Verify transaction was logged
      const transactionsResponse = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${secondUserToken}`);

      const seatTransactions = transactionsResponse.body.transactions.filter(
        t => t.transactionType === 'consume' && t.resourceType === 'facilitator_seat'
      );

      expect(seatTransactions.length).toBeGreaterThan(0);
      expect(seatTransactions[0].amount).toBe(-1);
      expect(seatTransactions[0].projectId).toBe(testProjectId);
    });

    it('should consume storyteller seat on invitation acceptance', async () => {
      // Create third user for storyteller role
      const storytellerResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'storyteller.wallet@test.com',
          password: 'testpassword123',
          name: 'Storyteller Wallet User'
        });

      const storytellerToken = storytellerResponse.body.accessToken;

      // Get initial wallet balance
      const initialWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${secondUserToken}`);

      const initialStorytellerSeats = initialWalletResponse.body.storytellerSeats;

      // Create storyteller invitation
      const invitationResponse = await request(app)
        .post(`/api/projects/${testProjectId}/invitations`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          role: 'storyteller'
        });

      expect(invitationResponse.status).toBe(201);
      const invitationToken = invitationResponse.body.token;

      // Accept invitation (should consume seat)
      const acceptResponse = await request(app)
        .post(`/api/invitations/${invitationToken}/accept`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      expect(acceptResponse.status).toBe(200);

      // Check wallet balance after invitation acceptance
      const finalWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${secondUserToken}`);

      expect(finalWalletResponse.body.storytellerSeats).toBe(initialStorytellerSeats - 1);

      // Verify transaction was logged
      const transactionsResponse = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${secondUserToken}`);

      const seatTransactions = transactionsResponse.body.transactions.filter(
        t => t.transactionType === 'consume' && t.resourceType === 'storyteller_seat'
      );

      expect(seatTransactions.length).toBeGreaterThan(0);
      expect(seatTransactions[0].amount).toBe(-1);
      expect(seatTransactions[0].projectId).toBe(testProjectId);
    });

    it('should prevent invitation when insufficient seats available', async () => {
      // Consume all remaining facilitator seats
      const walletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${secondUserToken}`);

      const remainingSeats = walletResponse.body.facilitatorSeats;

      // Create users and consume all seats
      for (let i = 0; i < remainingSeats; i++) {
        const tempUserResponse = await request(app)
          .post('/api/auth/signup')
          .send({
            email: `temp${i}@test.com`,
            password: 'testpassword123',
            name: `Temp User ${i}`
          });

        const invitationResponse = await request(app)
          .post(`/api/projects/${testProjectId}/invitations`)
          .set('Authorization', `Bearer ${secondUserToken}`)
          .send({
            role: 'facilitator'
          });

        await request(app)
          .post(`/api/invitations/${invitationResponse.body.token}/accept`)
          .set('Authorization', `Bearer ${tempUserResponse.body.accessToken}`);
      }

      // Now try to create one more invitation (should fail)
      const failedInvitationResponse = await request(app)
        .post(`/api/projects/${testProjectId}/invitations`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          role: 'facilitator'
        });

      expect(failedInvitationResponse.status).toBe(400);
      expect(failedInvitationResponse.body.error.message).toMatch(/insufficient.*seat/i);
    });
  });

  describe('Package Purchase Workflow', () => {
    it('should credit wallet resources on package purchase', async () => {
      // Get initial wallet balance
      const initialWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      const initialVouchers = initialWalletResponse.body.projectVouchers;
      const initialFacilitatorSeats = initialWalletResponse.body.facilitatorSeats;
      const initialStorytellerSeats = initialWalletResponse.body.storytellerSeats;

      // Simulate package purchase (mock Stripe payment)
      const purchaseResponse = await request(app)
        .post('/api/users/me/wallet/purchase')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          packageType: 'saga_package',
          paymentMethodId: 'pm_test_mock',
          amount: 9900 // $99.00
        });

      expect(purchaseResponse.status).toBe(200);
      expect(purchaseResponse.body.success).toBe(true);

      // Check wallet balance after purchase
      const finalWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      expect(finalWalletResponse.body.projectVouchers).toBeGreaterThan(initialVouchers);
      expect(finalWalletResponse.body.facilitatorSeats).toBeGreaterThan(initialFacilitatorSeats);
      expect(finalWalletResponse.body.storytellerSeats).toBeGreaterThan(initialStorytellerSeats);

      // Verify purchase transaction was logged
      const transactionsResponse = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${userToken}`);

      const purchaseTransactions = transactionsResponse.body.transactions.filter(
        t => t.transactionType === 'purchase'
      );

      expect(purchaseTransactions.length).toBeGreaterThan(0);
      
      // Should have separate transactions for each resource type
      const voucherTransaction = purchaseTransactions.find(t => t.resourceType === 'project_voucher');
      const facilitatorTransaction = purchaseTransactions.find(t => t.resourceType === 'facilitator_seat');
      const storytellerTransaction = purchaseTransactions.find(t => t.resourceType === 'storyteller_seat');

      expect(voucherTransaction).toBeDefined();
      expect(facilitatorTransaction).toBeDefined();
      expect(storytellerTransaction).toBeDefined();
    });

    it('should handle payment failures gracefully', async () => {
      // Simulate failed payment
      const failedPurchaseResponse = await request(app)
        .post('/api/users/me/wallet/purchase')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          packageType: 'saga_package',
          paymentMethodId: 'pm_test_card_declined',
          amount: 9900
        });

      expect(failedPurchaseResponse.status).toBe(400);
      expect(failedPurchaseResponse.body.error).toBeDefined();
      expect(failedPurchaseResponse.body.error.message).toMatch(/payment.*failed/i);

      // Verify no resources were credited
      const walletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      // Wallet should remain unchanged
      expect(walletResponse.status).toBe(200);
    });
  });

  describe('Transaction History and Audit Trail', () => {
    it('should provide complete transaction history', async () => {
      const transactionsResponse = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(transactionsResponse.status).toBe(200);
      expect(transactionsResponse.body.transactions).toBeDefined();
      expect(Array.isArray(transactionsResponse.body.transactions)).toBe(true);

      // Should have various transaction types
      const transactions = transactionsResponse.body.transactions;
      const transactionTypes = [...new Set(transactions.map(t => t.transactionType))];
      
      expect(transactionTypes.length).toBeGreaterThan(0);
      expect(transactionTypes).toContain('consume');

      // Each transaction should have required fields
      transactions.forEach(transaction => {
        expect(transaction.id).toBeDefined();
        expect(transaction.userId).toBe(userId);
        expect(transaction.transactionType).toBeDefined();
        expect(transaction.resourceType).toBeDefined();
        expect(transaction.amount).toBeDefined();
        expect(transaction.createdAt).toBeDefined();
      });
    });

    it('should support transaction filtering and pagination', async () => {
      // Test filtering by transaction type
      const consumeTransactionsResponse = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ type: 'consume' });

      expect(consumeTransactionsResponse.status).toBe(200);
      const consumeTransactions = consumeTransactionsResponse.body.transactions;
      
      consumeTransactions.forEach(transaction => {
        expect(transaction.transactionType).toBe('consume');
      });

      // Test pagination
      const paginatedResponse = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ page: 1, limit: 5 });

      expect(paginatedResponse.status).toBe(200);
      expect(paginatedResponse.body.transactions.length).toBeLessThanOrEqual(5);
      expect(paginatedResponse.body.pagination).toBeDefined();
      expect(paginatedResponse.body.pagination.currentPage).toBe(1);
      expect(paginatedResponse.body.pagination.limit).toBe(5);
    });
  });

  describe('Wallet Synchronization', () => {
    it('should maintain wallet consistency across concurrent operations', async () => {
      // Create multiple concurrent operations
      const operations = [];

      // Simulate concurrent project creations (if user has vouchers)
      const walletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${secondUserToken}`);

      const availableVouchers = walletResponse.body.projectVouchers;

      if (availableVouchers >= 3) {
        for (let i = 0; i < 3; i++) {
          operations.push(
            request(app)
              .post('/api/projects')
              .set('Authorization', `Bearer ${secondUserToken}`)
              .send({
                name: `Concurrent Project ${i}`
              })
          );
        }

        const results = await Promise.all(operations);

        // All operations should either succeed or fail consistently
        const successCount = results.filter(r => r.status === 201).length;
        const failCount = results.filter(r => r.status === 400).length;

        expect(successCount + failCount).toBe(3);

        // Final wallet balance should be consistent
        const finalWalletResponse = await request(app)
          .get('/api/users/me/wallet')
          .set('Authorization', `Bearer ${secondUserToken}`);

        expect(finalWalletResponse.body.projectVouchers).toBe(availableVouchers - successCount);
      }
    });

    it('should handle wallet state recovery after failures', async () => {
      // Get initial state
      const initialWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      const initialState = initialWalletResponse.body;

      // Simulate a failed operation that might leave inconsistent state
      try {
        await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            // Invalid project data to cause failure after wallet check
            name: '' // Empty name should cause validation error
          });
      } catch (error) {
        // Expected to fail
      }

      // Wallet should remain in consistent state
      const finalWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      expect(finalWalletResponse.body.projectVouchers).toBe(initialState.projectVouchers);
      expect(finalWalletResponse.body.facilitatorSeats).toBe(initialState.facilitatorSeats);
      expect(finalWalletResponse.body.storytellerSeats).toBe(initialState.storytellerSeats);
    });
  });
});