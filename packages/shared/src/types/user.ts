/**
 * User account interface for v1.5 unified account system
 * Roles are now project-specific and managed through ProjectRole interface
 */
export interface User {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  password_hash?: string;
  oauth_provider?: string;
  oauth_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  created_at: Date;
  resource_wallet?: {
    user_id: string;
    project_vouchers: number;
    facilitator_seats: number;
    storyteller_seats: number;
    updated_at: Date;
  };
  subscription?: {
    id: string;
    status: 'active' | 'canceled' | 'past_due';
    current_period_end: Date;
  };
}

export interface CreateUserRequest {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  phone?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email?: string;
  phone?: string;
  password: string;
}

export interface OAuthUser {
  id: string;
  name: string;
  email?: string;
  provider: string;
  provider_id: string;
}

export interface CreateUserInput {
  email?: string
  phone?: string
  name: string
  password?: string
  oauthProvider?: 'google' | 'apple'
  oauthId?: string
}

export interface UpdateUserInput {
  name?: string
  email?: string
  phone?: string
}

export interface AuthResult {
  user: User
  accessToken: string
  refreshToken: string
  expiresIn: number
}