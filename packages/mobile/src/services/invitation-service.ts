import { ApiClient } from './api-client';
import type { Invitation } from '@saga/shared/types/invitation';
import type { Project } from '@saga/shared/types/project';

export interface InvitationValidationResult {
  isValid: boolean;
  invitation?: Invitation;
  project?: Project;
  facilitators?: Array<{
    id: string;
    name: string;
    email?: string;
  }>;
  error?: string;
}

export interface AcceptInvitationResult {
  success: boolean;
  user?: any;
  token?: string;
  project?: Project;
  error?: string;
}

class InvitationServiceClass {
  async validateInvitation(invitationCode: string): Promise<InvitationValidationResult> {
    try {
      const response = await ApiClient.get(`/invitations/validate/${invitationCode}`);
      
      return {
        isValid: true,
        invitation: response.data.invitation,
        project: response.data.project,
        facilitators: response.data.facilitators || [],
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.response?.data?.message || 'Invalid invitation code',
      };
    }
  }

  async acceptInvitation(invitationCode: string, userData: {
    name: string;
    phone?: string;
    email?: string;
  }): Promise<AcceptInvitationResult> {
    try {
      const response = await ApiClient.post('/invitations/accept', {
        token: invitationCode,
        ...userData,
      });

      const { user, token, project } = response.data;

      // Set the auth token for future requests
      ApiClient.setAuthToken(token);

      return {
        success: true,
        user,
        token,
        project,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to accept invitation',
      };
    }
  }

  async getProjectInfo(projectId: string): Promise<Project | null> {
    try {
      const response = await ApiClient.get(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get project info:', error);
      return null;
    }
  }

  // Extract invitation code from various URL formats
  parseInvitationFromUrl(url: string): string | null {
    try {
      // Handle deep link format: saga://invitation?code=ABC123
      if (url.includes('saga://invitation')) {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('code');
      }

      // Handle web link format: https://saga.app/invite/ABC123
      if (url.includes('/invite/')) {
        const parts = url.split('/invite/');
        return parts[1]?.split('?')[0] || null;
      }

      // Handle direct code
      if (url.length === 8 && /^[A-Z0-9]+$/.test(url)) {
        return url;
      }

      return null;
    } catch (error) {
      console.error('Failed to parse invitation URL:', error);
      return null;
    }
  }
}

export const InvitationService = new InvitationServiceClass();