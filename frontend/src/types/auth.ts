export type UserRole = 'ADMIN' | 'MANAGER';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ManagedUser extends AuthUser {
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateManagerPayload {
  name: string;
  email: string;
  password: string;
}

export interface UpdateManagerPayload {
  name?: string;
  email?: string;
  isActive?: boolean;
}
