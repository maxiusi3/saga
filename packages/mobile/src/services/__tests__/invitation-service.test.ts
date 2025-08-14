import { InvitationService } from '../invitation-service';

// Mock the API client
jest.mock('../api-client', () => ({
  ApiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setAuthToken: jest.fn(),
  },
}));

describe('InvitationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseInvitationFromUrl', () => {
    it('should parse invitation code from deep link format', () => {
      const url = 'saga://invitation?code=ABC12345';
      const result = InvitationService.parseInvitationFromUrl(url);
      expect(result).toBe('ABC12345');
    });

    it('should parse invitation code from web link format', () => {
      const url = 'https://saga.app/invite/XYZ98765';
      const result = InvitationService.parseInvitationFromUrl(url);
      expect(result).toBe('XYZ98765');
    });

    it('should parse direct invitation code', () => {
      const code = 'DEF54321';
      const result = InvitationService.parseInvitationFromUrl(code);
      expect(result).toBe('DEF54321');
    });

    it('should return null for invalid URLs', () => {
      const invalidUrl = 'https://example.com/invalid';
      const result = InvitationService.parseInvitationFromUrl(invalidUrl);
      expect(result).toBeNull();
    });

    it('should return null for malformed codes', () => {
      const invalidCode = 'abc123'; // lowercase, too short
      const result = InvitationService.parseInvitationFromUrl(invalidCode);
      expect(result).toBeNull();
    });
  });

  describe('validateInvitation', () => {
    it('should validate a valid invitation code', async () => {
      const mockResponse = {
        data: {
          invitation: { id: '1', token: 'ABC12345' },
          project: { id: '1', name: 'Test Project' },
        },
      };

      const { ApiClient } = require('../api-client');
      ApiClient.get.mockResolvedValue(mockResponse);

      const result = await InvitationService.validateInvitation('ABC12345');

      expect(result.isValid).toBe(true);
      expect(result.invitation).toEqual(mockResponse.data.invitation);
      expect(result.project).toEqual(mockResponse.data.project);
      expect(ApiClient.get).toHaveBeenCalledWith('/invitations/validate/ABC12345');
    });

    it('should handle invalid invitation code', async () => {
      const { ApiClient } = require('../api-client');
      ApiClient.get.mockRejectedValue({
        response: { data: { message: 'Invalid invitation code' } },
      });

      const result = await InvitationService.validateInvitation('INVALID');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid invitation code');
    });
  });

  describe('acceptInvitation', () => {
    it('should accept a valid invitation', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', name: 'Test User' },
          token: 'jwt-token',
          project: { id: '1', name: 'Test Project' },
        },
      };

      const { ApiClient } = require('../api-client');
      ApiClient.post.mockResolvedValue(mockResponse);

      const userData = {
        name: 'Test User',
        phone: '+1234567890',
        email: 'test@example.com',
      };

      const result = await InvitationService.acceptInvitation('ABC12345', userData);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockResponse.data.user);
      expect(result.token).toBe('jwt-token');
      expect(ApiClient.post).toHaveBeenCalledWith('/invitations/accept', {
        token: 'ABC12345',
        ...userData,
      });
      expect(ApiClient.setAuthToken).toHaveBeenCalledWith('jwt-token');
    });

    it('should handle invitation acceptance failure', async () => {
      const { ApiClient } = require('../api-client');
      ApiClient.post.mockRejectedValue({
        response: { data: { message: 'Invitation expired' } },
      });

      const userData = {
        name: 'Test User',
        phone: '+1234567890',
        email: 'test@example.com',
      };

      const result = await InvitationService.acceptInvitation('EXPIRED', userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invitation expired');
    });
  });
});