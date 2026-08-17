export const ZENTRAQ_ROLES = [
  "admin",
  "doctor",
  "nurse",
  "student",
  "faculty",
  "staff",
] as const;

export type ZentraqRole = (typeof ZENTRAQ_ROLES)[number];

export interface AuthContext {
  expiresAt: number;
  requestId: string;
  roles: ZentraqRole[];
  userId: string;
}

export interface Pagination {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  data: T;
  pagination?: Pagination;
  success: true;
}

export interface ApiFailure {
  error: {
    code: string;
    message: string;
  };
  success: false;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requestId: string;
      startedAt: number;
    }
  }
}
