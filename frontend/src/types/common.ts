export interface PaginatedResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ErrorBody {
  code: string;
  message: string;
  field?: string | null;
}

export interface StandardResponse<T> {
  success: boolean;
  data: T | null;
  pagination: PaginatedResponse | null;
  error: ErrorBody | null;
}
