import {
  ErrorResponse, UserResponse, MonthlySummary, ImportResult, InventoryResponse, InventoryRequest,
  MealResponse, MealRequest, LlmConfigResponse, LlmConfigRequest, LlmConfigsResponse, LlmPurpose, ChatSessionResponse,
  ChatMessageResponse, SendMessageResponse, GoalResponse, GoalRequest, FixedCostResponse,
  FixedCostRequest, SimulationResult, ReceiptDraft,
} from '@/types';
import { getUserId } from './auth';

const API_BASE = '/api';

/**
 * 共通APIリクエストラッパー
 * - X-User-Id ヘッダーを自動付与
 * - エラーレスポンスを統一的にハンドリング
 * - body が FormData の場合は Content-Type を付与しない（ブラウザが境界付きで設定する）
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const userId = getUserId();

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  // 認証が必要なエンドポイントにはX-User-Idを付与
  if (userId !== null) {
    headers['X-User-Id'] = String(userId);
  }

  const relativeUrl = `${API_BASE}${endpoint}`;
  // 実際に叩く絶対URL（デバッグ用にエラーへ含める。localhostか否かがこれで分かる）
  const absoluteUrl =
    typeof window !== 'undefined'
      ? new URL(relativeUrl, window.location.origin).href
      : relativeUrl;

  let response: Response;
  try {
    response = await fetch(relativeUrl, {
      ...options,
      headers,
    });
  } catch (e) {
    // ネットワーク到達不可（サーバーに繋がらない/CORS/オフライン等）
    throw new ApiError(
      `サーバーに接続できませんでした。接続先: ${absoluteUrl}（${(e as Error).message}）`,
      0
    );
  }

  // 204 No Content の場合はそのまま返す
  if (response.status === 204) {
    return undefined as T;
  }

  // JSON以外（プロキシのHTMLエラーページ等）でも落ちないようテキスト経由で解釈
  const rawText = await response.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (data && typeof data === 'object') {
      const errorData = data as ErrorResponse;
      throw new ApiError(
        errorData.message || 'エラーが発生しました',
        errorData.status ?? response.status,
        errorData.validationErrors ?? undefined
      );
    }
    // JSONでないエラー応答（例: プロキシ502、バックエンド未起動など）
    throw new ApiError(
      `サーバーエラー (HTTP ${response.status})。接続先: ${absoluteUrl}${rawText ? ` / ${rawText.slice(0, 120)}` : ''}`,
      response.status
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
  create: (name: string, type: 'INCOME' | 'EXPENSE' = 'EXPENSE') =>
    fetchApi('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, type }),
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

// --- Analytics API ---
export const analyticsApi = {
  getMonthlySummary: (year: number, month: number) =>
    fetchApi<MonthlySummary>(`/analytics/monthly?year=${year}&month=${month}`),
};

// --- Import API ---
export const importApi = {
  import: (format: 'csv' | 'markdown', content: string) =>
    fetchApi<ImportResult>('/import', {
      method: 'POST',
      body: JSON.stringify({ format, content }),
    }),
};

// --- Inventory API ---
export const inventoryApi = {
  getAll: (storage?: string) =>
    fetchApi<InventoryResponse[]>(`/inventory${storage ? `?storage=${storage}` : ''}`),
  getExpiringSoon: (days: number = 3) =>
    fetchApi<InventoryResponse[]>(`/inventory/expiring?days=${days}`),
  create: (data: InventoryRequest) =>
    fetchApi<InventoryResponse>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: InventoryRequest) =>
    fetchApi<InventoryResponse>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  consume: (id: number) =>
    fetchApi<InventoryResponse>(`/inventory/${id}/consume`, {
      method: 'PUT',
    }),
  delete: (id: number) =>
    fetchApi<void>(`/inventory/${id}`, {
      method: 'DELETE',
    }),
};

// --- Meal API ---
export const mealApi = {
  getAll: (since: string, until: string) =>
    fetchApi<MealResponse[]>(`/meals?since=${since}&until=${until}`),
  getById: (id: number) =>
    fetchApi<MealResponse>(`/meals/${id}`),
  create: (data: MealRequest) =>
    fetchApi<MealResponse>('/meals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    fetchApi<void>(`/meals/${id}`, {
      method: 'DELETE',
    }),
};

// --- LLM設定（ユーザごとのAPIキー・チャット用/画像用の2系統） ---
export const llmConfigApi = {
  get: () => fetchApi<LlmConfigsResponse>('/users/me/llm-config'),
  save: (purpose: LlmPurpose, data: LlmConfigRequest) =>
    fetchApi<LlmConfigResponse>(`/users/me/llm-config/${purpose}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (purpose: LlmPurpose) =>
    fetchApi<void>(`/users/me/llm-config/${purpose}`, { method: 'DELETE' }),
};

// --- AIチャット ---
export const chatApi = {
  listSessions: () => fetchApi<ChatSessionResponse[]>('/chats'),
  createSession: (title?: string) =>
    fetchApi<ChatSessionResponse>('/chats', {
      method: 'POST',
      body: JSON.stringify({ title: title ?? null }),
    }),
  updateTitle: (id: number, title: string) =>
    fetchApi<ChatSessionResponse>(`/chats/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteSession: (id: number) =>
    fetchApi<void>(`/chats/${id}`, { method: 'DELETE' }),
  listMessages: (id: number) =>
    fetchApi<ChatMessageResponse[]>(`/chats/${id}/messages`),
  sendMessage: (id: number, content: string, image?: Blob | null) => {
    const formData = new FormData();
    formData.append('content', content);
    if (image) formData.append('file', image, 'chat-image.jpg');
    return fetchApi<SendMessageResponse>(`/chats/${id}/messages`, {
      method: 'POST',
      body: formData,
    });
  },
  editMessage: (id: number, messageId: number, content: string) =>
    fetchApi<ChatMessageResponse>(`/chats/${id}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),
  deleteMessage: (id: number, messageId: number) =>
    fetchApi<void>(`/chats/${id}/messages/${messageId}`, { method: 'DELETE' }),
};

/**
 * ストリーミング送信（SSE）。fetch のストリームを読み、event ごとにコールバックを呼ぶ。
 * events: user（保存済みユーザーメッセージ）→ chunk（差分テキスト）* → done（完成AIメッセージ）/ error
 */
export async function sendMessageStream(
  sessionId: number,
  content: string,
  image: Blob | null,
  handlers: {
    onUser?: (m: ChatMessageResponse) => void;
    onChunk?: (text: string) => void;
    onDone?: (m: ChatMessageResponse) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  const userId = getUserId();
  const formData = new FormData();
  formData.append('content', content);
  if (image) formData.append('file', image, 'chat-image.jpg');
  const headers: Record<string, string> = {};
  if (userId !== null) headers['X-User-Id'] = String(userId);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chats/${sessionId}/messages/stream`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (e) {
    handlers.onError?.(`サーバーに接続できませんでした: ${(e as Error).message}`);
    return;
  }

  if (!response.ok || !response.body) {
    let msg = `送信に失敗しました (HTTP ${response.status})`;
    try {
      const d = await response.json();
      if (d?.message) msg = d.message;
    } catch {
      /* ignore */
    }
    handlers.onError?.(msg);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleFrame = (frame: string) => {
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (event === 'user') handlers.onUser?.(parsed);
      else if (event === 'chunk') handlers.onChunk?.(parsed.text ?? '');
      else if (event === 'done') handlers.onDone?.(parsed);
      else if (event === 'error') handlers.onError?.(parsed.message ?? 'エラーが発生しました');
    } catch {
      /* 壊れたフレームはスキップ */
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (frame.trim()) handleFrame(frame);
    }
  }
}

// --- 貯蓄目標 ---
export const goalApi = {
  // 未設定時は 204 → undefined
  get: () => fetchApi<GoalResponse | undefined>('/goals'),
  save: (data: GoalRequest) =>
    fetchApi<GoalResponse>('/goals', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: () => fetchApi<void>('/goals', { method: 'DELETE' }),
};

// --- 固定費 ---
export const fixedCostApi = {
  getAll: () => fetchApi<FixedCostResponse[]>('/fixed-costs'),
  create: (data: FixedCostRequest) =>
    fetchApi<FixedCostResponse>('/fixed-costs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: FixedCostRequest) =>
    fetchApi<FixedCostResponse>(`/fixed-costs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    fetchApi<void>(`/fixed-costs/${id}`, { method: 'DELETE' }),
};

// --- シミュレーション ---
export const simulationApi = {
  run: (age?: number) =>
    fetchApi<SimulationResult>(`/simulation${age ? `?age=${age}` : ''}`),
};

// --- レシートOCR ---
export const receiptApi = {
  scan: (file: Blob) => {
    const formData = new FormData();
    formData.append('file', file, 'receipt.jpg');
    return fetchApi<ReceiptDraft>('/receipts/scan', {
      method: 'POST',
      body: formData,
    });
  },
};
