import { ResourceWalletModel, SeatTransactionModel } from '../models/resource-wallet';
import { UserModel } from '../models/user';
import { setupTestDatabase, teardownTestDatabase } from './setup';

describe('ResourceWalletModel', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    // Clean up tables
    await ResourceWalletModel.query().delete();
    await SeatTransactionModel.query().delete();
    await UserModel.query().delete();
  });

  describe('createWallet', () => {
    it('should create a wallet with default credits', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      const wallet = await ResourceWalletModel.createWallet(user.id);

      expect(wallet.user_id).toBe(user.id);
      expect(wallet.project_vouchers).toBe(0);
      expect(wallet.facilitator_seats).toBe(0);
      expect(wallet.storyteller_seats).toBe(0);
    });

    it('should create a wallet with custom initial credits', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      const initialCredits = {
        project_vouchers: 5,
        facilitator_seats: 3,
        storyteller_seats: 2,
      };

      const wallet = await ResourceWalletModel.createWallet(user.id, initialCredits);

      expect(wallet.project_vouchers).toBe(5);
      expect(wallet.facilitator_seats).toBe(3);
      expect(wallet.storyteller_seats).toBe(2);
    });
  });

  describe('getBalance', () => {
    it('should return current balance', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      await ResourceWalletModel.createWallet(user.id, {
        project_vouchers: 5,
        facilitator_seats: 3,
        storyteller_seats: 2,
      });

      const balance = await ResourceWalletModel.getBalance(user.id);

      expect(balance.project_vouchers).toBe(5);
      expect(balance.facilitator_seats).toBe(3);
      expect(balance.storyteller_seats).toBe(2);
    });

    it('should throw error if wallet not found', async () => {
      await expect(ResourceWalletModel.getBalance('non-existent-id'))
        .rejects.toThrow('Resource wallet not found');
    });
  });

  describe('hasResources', () => {
    it('should return true if user has sufficient resources', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      await ResourceWalletModel.createWallet(user.id, {
        project_vouchers: 5,
        facilitator_seats: 3,
        storyteller_seats: 2,
      });

      const hasVouchers = await ResourceWalletModel.hasResources(user.id, {
        resource_type: 'project_voucher',
        amount: 3,
        project_id: 'test-project',
      });

      expect(hasVouchers).toBe(true);
    });

    it('should return false if user has insufficient resources', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      await ResourceWalletModel.createWallet(user.id, {
        project_vouchers: 2,
        facilitator_seats: 1,
        storyteller_seats: 0,
      });

      const hasSeats = await ResourceWalletModel.hasResources(user.id, {
        resource_type: 'facilitator_seat',
        amount: 3,
        project_id: 'test-project',
      });

      expect(hasSeats).toBe(false);
    });
  });

  describe('consumeResources', () => {
    it('should consume resources and log transaction', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      await ResourceWalletModel.createWallet(user.id, {
        project_vouchers: 5,
        facilitator_seats: 3,
        storyteller_seats: 2,
      });

      const updatedWallet = await ResourceWalletModel.consumeResources(user.id, {
        resource_type: 'project_voucher',
        amount: 1,
        project_id: 'test-project',
      });

      expect(updatedWallet.project_vouchers).toBe(4);

      // Check transaction was logged
      const transactions = await SeatTransactionModel.getTransactionHistory(user.id);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].transaction_type).toBe('consume');
      expect(transactions[0].resource_type).toBe('project_voucher');
      expect(transactions[0].amount).toBe(-1);
    });

    it('should throw error if insufficient resources', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      await ResourceWalletModel.createWallet(user.id, {
        project_vouchers: 1,
        facilitator_seats: 0,
        storyteller_seats: 0,
      });

      await expect(ResourceWalletModel.consumeResources(user.id, {
        resource_type: 'facilitator_seat',
        amount: 1,
        project_id: 'test-project',
      })).rejects.toThrow('Insufficient facilitator seats');
    });
  });

  describe('creditResources', () => {
    it('should credit resources and log transaction', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      await ResourceWalletModel.createWallet(user.id);

      const updatedWallet = await ResourceWalletModel.creditResources(
        user.id,
        'project_voucher',
        5,
        'purchase'
      );

      expect(updatedWallet.project_vouchers).toBe(5);

      // Check transaction was logged
      const transactions = await SeatTransactionModel.getTransactionHistory(user.id);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].transaction_type).toBe('purchase');
      expect(transactions[0].resource_type).toBe('project_voucher');
      expect(transactions[0].amount).toBe(5);
    });
  });
});

describe('SeatTransactionModel', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await SeatTransactionModel.query().delete();
    await UserModel.query().delete();
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history for user', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      // Create some transactions
      await SeatTransactionModel.query().insert([
        {
          user_id: user.id,
          transaction_type: 'purchase',
          resource_type: 'project_voucher',
          amount: 5,
        },
        {
          user_id: user.id,
          transaction_type: 'consume',
          resource_type: 'project_voucher',
          amount: -1,
          project_id: 'test-project',
        },
      ]);

      const transactions = await SeatTransactionModel.getTransactionHistory(user.id);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].transaction_type).toBe('consume'); // Most recent first
      expect(transactions[1].transaction_type).toBe('purchase');
    });

    it('should respect limit and offset', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'test@example.com',
      });

      // Create multiple transactions
      for (let i = 0; i < 5; i++) {
        await SeatTransactionModel.query().insert({
          user_id: user.id,
          transaction_type: 'purchase',
          resource_type: 'project_voucher',
          amount: 1,
        });
      }

      const transactions = await SeatTransactionModel.getTransactionHistory(user.id, 2, 1);

      expect(transactions).toHaveLength(2);
    });
  });
});