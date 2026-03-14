/**
 * Shared API types — standard request/response wrappers, pagination, errors.
 * Every API response follows these shapes for consistency.
 */

// Standard paginated list response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Standard single-item response
export interface ApiResponse<T> {
  data: T;
}

// Standard error response — matches architecture spec §7.4
export interface ApiError {
  error: {
    code: string;           // Machine-readable, SCREAMING_SNAKE_CASE
    message: string;        // Human-readable description
    details?: Record<string, unknown>; // Structured additional info
    requestId: string;      // For log correlation
  };
}

// Pagination query parameters
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

// Authenticated request context (populated by auth middleware)
export interface AuthContext {
  userId: string;
  userRole: string;
  brandId?: string; // if user is acting as a brand
}

// Job payload types (used by BullMQ workers)
export interface JobPayload {
  campaignId?: string;
  brandId?: string;
  userId?: string;
  manufacturerId?: string;
  backingId?: string;
  orderId?: string;
  shopId?: string;
  topic?: string;
  payload?: Record<string, unknown>;
}
