import {
  UserResourceWallet,
  SeatTransaction,
  ProjectRole,
  Chapter,
  Prompt,
  Project,
  Story,
  User,
  Subscription,
  ApiResponse,
  PaginatedResponse
} from '../index';

describe('Type Definitions', () => {
  describe('UserResourceWallet', () => {
    it('should have correct structure', () => {
      const wallet: UserResourceWallet = {
        user_id: 'user-123',
        project_vouchers: 5,
        facilitator_seats: 3,
        storyteller_seats: 2,
        updated_at: new Date()
      };
      
      expect(wallet.user_id).toBe('user-123');
      expect(wallet.project_vouchers).toBe(5);
    });
  });

  describe('SeatTransaction', () => {
    it('should have correct transaction types', () => {
      const transaction: SeatTransaction = {
        id: 'txn-123',
        user_id: 'user-123',
        transaction_type: 'purchase',
        resource_type: 'facilitator_seat',
        amount: 2,
        created_at: new Date()
      };
      
      expect(transaction.transaction_type).toBe('purchase');
      expect(transaction.resource_type).toBe('facilitator_seat');
    });
  });

  describe('ProjectRole', () => {
    it('should have correct role types', () => {
      const role: ProjectRole = {
        id: 'role-123',
        project_id: 'project-123',
        user_id: 'user-123',
        role: 'facilitator',
        created_at: new Date()
      };
      
      expect(role.role).toBe('facilitator');
    });
  });

  describe('Chapter', () => {
    it('should have correct structure', () => {
      const chapter: Chapter = {
        id: 'chapter-123',
        name: 'Early Life & Childhood',
        description: 'Stories about early memories',
        order_index: 1,
        is_active: true,
        created_at: new Date()
      };
      
      expect(chapter.name).toBe('Early Life & Childhood');
      expect(chapter.order_index).toBe(1);
    });
  });

  describe('Prompt', () => {
    it('should have v1.5 fields', () => {
      const prompt: Prompt = {
        id: 'prompt-123',
        text: 'Tell me about your childhood',
        category: 'childhood',
        difficulty: 'easy',
        is_library_prompt: true,
        chapter_id: 'chapter-123',
        order_index: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      expect(prompt.chapter_id).toBe('chapter-123');
      expect(prompt.order_index).toBe(1);
      expect(prompt.is_active).toBe(true);
    });
  });

  describe('Project', () => {
    it('should have updated status types', () => {
      const project: Project = {
        id: 'project-123',
        name: 'Family Stories',
        facilitator_id: 'user-123',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      expect(project.status).toBe('active');
      // Should not have subscription_expires_at
      expect('subscription_expires_at' in project).toBe(false);
    });
  });

  describe('Story', () => {
    it('should have v1.5 fields', () => {
      const story: Story = {
        id: 'story-123',
        project_id: 'project-123',
        facilitator_id: 'user-123',
        storyteller_id: 'user-456',
        transcript: 'This is my story...',
        audio_url: 'https://example.com/audio.mp3',
        status: 'published',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      expect(story.chapter_id).toBeUndefined();
      expect(story.prompt_id).toBeUndefined();
      expect(story.original_transcript).toBeUndefined();
      expect(story.audio_duration).toBeUndefined();
    });
  });

  describe('API Response Types', () => {
    it('should work with ApiResponse', () => {
      const response: ApiResponse<Project> = {
        success: true,
        data: {
          id: 'project-123',
          name: 'Test Project',
          facilitator_id: 'user-123',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      };
      
      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Test Project');
    });

    it('should work with PaginatedResponse', () => {
      const response: PaginatedResponse<Story> = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        has_more: false
      };
      
      expect(response.page).toBe(1);
      expect(response.has_more).toBe(false);
    });
  });
});