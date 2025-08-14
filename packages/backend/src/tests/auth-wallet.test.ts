import request from 'supertest';
import { app } from '../index';
import { UserModel } from '../models/user';
import { ResourceWalletModel } from '../models/resource-wallet';
import { setupTestDatabase, teardownTestDatabase } from './setup';

describe('Authentication with Resource Wallet', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    // Clean up tables
    await ResourceWalletModel.query().delete();
    await UserModel.query().delete();
  });

  describe('POST /api/auth/signup', () => {
    it('should create user with resource wallet automatically', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      const userId = response.body.data.user.id;

      // Check that resource wallet was created
      const wallet = await ResourceWalletModel.getWallet(userId);
      expect(wallet).toBeDefined();
      expect(wallet?.user_id).toBe(userId);
      expect(wallet?.project_vouchers).toBe(0); // Default value
      expect(wallet?.facilitator_seats).toBe(0);
      expect(wallet?.storyteller_seats).toBe(0);
    });

    it('should create user with default credits from environment', async () => {
      // Set environment variables for test
      process.env.DEFAULT_PROJECT_VOUCHERS = '1';
      process.env.DEFAULT_FACILITATOR_SEATS = '2';
      process.env.DEFAULT_STORYTELLER_SEATS = '1';

      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password123',
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      const userId = response.body.data.user.id;

      // Check that resource wallet was created with default credits
      const wallet = await ResourceWalletModel.getWallet(userId);
      expect(wallet?.project_vouchers).toBe(1);
      expect(wallet?.facilitator_seats).toBe(2);
      expect(wallet?.storyteller_seats).toBe(1);

      // Clean up environment variables
      delete process.env.DEFAULT_PROJECT_VOUCHERS;
      delete process.env.DEFAULT_FACILITATOR_SEATS;
      delete process.env.DEFAULT_STORYTELLER_SEATS;
    });
  });

  describe('POST /api/auth/signin/google', () => {
    it('should create user with resource wallet for OAuth signup', async () => {
      const oauthData = {
        name: 'Google User',
        email: 'google@example.com',
        oauthProvider: 'google',
        oauthId: 'google123',
      };

      const response = await request(app)
        .post('/api/auth/signin/google')
        .send(oauthData)
        .expect(200);

      const userId = response.body.data.user.id;

      // Check that resource wallet was created
      const wallet = await ResourceWalletModel.getWallet(userId);
      expect(wallet).toBeDefined();
      expect(wallet?.user_id).toBe(userId);
    });
  });

  describe('GET /api/users/me/profile', () => {
    it('should return user profile with wallet information', async () => {
      // Create user with wallet
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      await ResourceWalletModel.createWallet(user.id, {
        project_vouchers: 5,
        facilitator_seats: 3,
        storyteller_seats: 2,
      });

      // Generate token for authentication
      const token = require('../config/auth').AuthConfig.generateTokens(user).accessToken;

      const response = await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.id).toBe(user.id);
      expect(response.body.data.resource_wallet).toBeDefined();
      expect(response.body.data.resource_wallet.project_vouchers).toBe(5);
      expect(response.body.data.resource_wallet.facilitator_seats).toBe(3);
      expect(response.body.data.resource_wallet.storyteller_seats).toBe(2);
    });
  });

  describe('GET /api/users/me/wallet', () => {
    it('should return wallet balance', async () => {
      // Create user with wallet
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      await ResourceWalletModel.createWallet(user.id, {
        project_vouchers: 10,
        facilitator_seats: 5,
        storyteller_seats: 3,
      });

      // Generate token for authentication
      const token = require('../config/auth').AuthConfig.generateTokens(user).accessToken;

      const response = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.project_vouchers).toBe(10);
      expect(response.body.data.facilitator_seats).toBe(5);
      expect(response.body.data.storyteller_seats).toBe(3);
    });
  });

  describe('GET /api/users/me/transactions', () => {
    it('should return transaction history', async () => {
      // Create user with wallet
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      const wallet = await ResourceWalletModel.createWallet(user.id);

      // Create some transactions
      await ResourceWalletModel.creditResources(user.id, 'project_voucher', 5, 'purchase');
      await ResourceWalletModel.consumeResources(user.id, {
        resource_type: 'project_voucher',
        amount: 1,
        project_id: 'test-project',
      });

      // Generate token for authentication
      const token = require('../config/auth').AuthConfig.generateTokens(user).accessToken;

      const response = await request(app)
        .get('/api/users/me/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].transaction_type).toBe('consume'); // Most recent first
      expect(response.body.data[1].transaction_type).toBe('purchase');
    });
  });
});