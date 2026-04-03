export interface UserOut {
  user_id: string;
  full_name: string;
  role: string;
  preferred_language: string;
  /** Login / JWT; used for ownership checks (e.g. employee list edit). */
  email?: string;
  force_password_change?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  pagination: null;
  error: ApiError | null;
}

export interface PaginatedEnvelope<T> {
  success: boolean;
  data: T;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null;
  error: ApiError | null;
}

export interface LoginSuccessData {
  access_token: string;
  token_type: string;
  force_password_change: boolean;
  user: Omit<UserOut, "force_password_change">;
}
