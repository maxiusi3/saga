import {
  ResourceType,
  TransactionType,
  ApiResponse,
  PaginatedResponse
} from '../index';

describe('Type Definitions', () => {
  describe('Resource Types', () => {
    it('should have correct resource types', () => {
      const resourceTypes: ResourceType[] = [
        'project_voucher',
        'facilitator_seat', 
        'storyteller_seat'
      ];
      
      expect(resourceTypes).toContain('project_voucher');
      expect(resourceTypes).toContain('facilitator_seat');
      expect(resourceTypes).toContain('storyteller_seat');
    });
  });

  describe('Transaction Types', () => {
    it('should have correct transaction types', () => {
      const transactionTypes: TransactionType[] = [
        'purchase',
        'consume',
        'refund',
        'grant',
        'expire'
      ];
      
      expect(transactionTypes).toContain('purchase');
      expect(transactionTypes).toContain('consume');
    });
  });

  describe('API Response Types', () => {
    it('should work with ApiResponse', () => {
      const response: ApiResponse<{ id: string; name: string }> = {
        success: true,
        data: {
          id: 'test-123',
          name: 'Test Item'
        }
      };
      
      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Test Item');
    });

    it('should work with error response', () => {
      const response: ApiResponse<any> = {
        success: false,
        error: 'Something went wrong'
      };
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
    });

    it('should work with PaginatedResponse', () => {
      const response: PaginatedResponse<{ id: string }> = {
        data: [{ id: '1' }, { id: '2' }],
        total: 2,
        page: 1,
        limit: 10,
        has_more: false
      };
      
      expect(response.page).toBe(1);
      expect(response.has_more).toBe(false);
      expect(response.data).toHaveLength(2);
    });
  });
});