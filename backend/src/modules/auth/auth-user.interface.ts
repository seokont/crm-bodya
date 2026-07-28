import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthTokenPayload {
  sub: number;
  name: string;
  email: string;
  role: UserRole;
}
