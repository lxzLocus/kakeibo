import { ErrorResponse, UserResponse } from '@/types';
import { getUserId } from './auth';

const API_BASE = '/api';

/**
 * 共通APIリクエストラッパー
 * - X-User-Id ヘッダーを自動付与
 * - エラーレスポンスを統一的にハンドリング
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const userId = getUserId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // 認証が必要なエンドポイントにはX-User-Idを付与
  if (userId !== null) {
    headers['X-User-Id'] = String(userId);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // 204 No Content の場合はそのまま返す
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ErrorResponse;
    throw new ApiError(
      errorData.message || 'エラーが発生しました',
      errorData.status,
      errorData.validationErrors ?? undefined
    );
  }

  return data as T;
}

/**
 * APIエラークラス
 */
export class ApiError extends Error {
  status: number;
  validationErrors?: Record<string, string>;

  constructor(message: string, status: number, validationErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

// --- User API ---
export const userApi = {
  login: (email: string, password: string) =>
    fetchApi<UserResponse>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (username: string, email: string, password: string) =>
    fetchApi<UserResponse>('/users/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),
};

// --- Entry API ---
export const entryApi = {
  getAll: (since?: string, until?: string) => {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (until) params.set('until', until);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchApi(`/entries${query}`);
  },

  create: (data: {
    entryDate: string;
    amount: number;
    categoryId: number;
    storeId?: number | null;
    type: 'INCOME' | 'EXPENSE';
    memo?: string | null;
  }) =>
    fetchApi('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (entryId: number, data: {
    entryDate: string;
    amount: number;
    categoryId: number;
    storeId?: number | null;
    type: 'INCOME' | 'EXPENSE';
    memo?: string | null;
  }) =>
    fetchApi(`/entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (entryId: number) =>
    fetchApi(`/entries/${entryId}`, { method: 'DELETE' }),
};

// --- Category API ---
export const categoryApi = {
  getAll: () => fetchApi('/categories'),
  create: (name: string) =>
    fetchApi('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  update: (categoryId: number, name: string) =>
    fetchApi(`/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),
  delete: (categoryId: number) =>
    fetchApi(`/categories/${categoryId}`, { method: 'DELETE' }),
};

// --- Store API ---
export const storeApi = {
  getAll: () => fetchApi('/stores'),
  create: (name: string, type?: string) =>
    fetchApi('/stores', {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    }),
  update: (storeId: number, name: string, type?: string) =>
    fetchApi(`/stores/${storeId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, type }),
    }),
  delete: (storeId: number) =>
    fetchApi(`/stores/${storeId}`, { method: 'DELETE' }),
};
