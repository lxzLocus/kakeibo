// ==========================================
// バックエンド DTO に対応する TypeScript 型定義
// ==========================================

// --- 共通 Enum ---
export type EntryType = 'INCOME' | 'EXPENSE';

// --- User ---
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
}

// --- Category ---
export interface CategoryRequest {
  name: string;
  type?: EntryType;
}

export interface CategoryResponse {
  categoryId: number;
  name: string;
  type: EntryType;
  createdAt: string;
}

// --- Store ---
export interface StoreRequest {
  name: string;
  type?: string | null;
}

export interface StoreResponse {
  storeId: number;
  name: string;
  type: string | null;
  createdAt: string;
}

// --- Entry ---
export interface EntryRequest {
  entryDate: string;        // yyyy-MM-dd
  amount: number;
  categoryId: number;
  storeId?: number | null;
  type: EntryType;
  memo?: string | null;
}

export interface EntryResponse {
  id: number;
  userId: number;
  username: string;
  entryDate: string;        // yyyy-MM-dd
  amount: number;
  categoryId: number;
  categoryName: string;
  storeId: number | null;
  storeName: string | null;
  type: EntryType;
  memo: string | null;
}

// --- Error ---
export interface ErrorResponse {
  status: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
  validationErrors?: Record<string, string> | null;
}

// --- Analytics ---
export interface CategorySummary {
  categoryId: number;
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface StoreSummary {
  storeId: number;
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface DailySummary {
  date: string;           // yyyy-MM-dd
  income: number;
  expense: number;
}

export interface MonthlySummary {
  month: string;           // "2026-05"
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  dailyAverageExpense: number;
  byCategory: CategorySummary[];
  byStore: StoreSummary[];
  dailyTrend: DailySummary[];
}

// --- Import ---
export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  createdEntryIds: number[];
}

// --- Inventory ---
export interface InventoryResponse {
  id: number;
  itemName: string;
  quantity: number;
  unit: string;
  purchasePrice?: number;
  purchaseDate?: string;
  expiryDate?: string;
  storage: 'REFRIGERATED' | 'FROZEN' | 'ROOM_TEMP';
  isConsumed: boolean;
  daysUntilExpiry?: number;
  createdAt: string;
}

export interface InventoryRequest {
  itemName: string;
  quantity: number;
  unit?: string;
  purchasePrice?: number;
  purchaseDate?: string;
  expiryDate?: string;
  storage?: 'REFRIGERATED' | 'FROZEN' | 'ROOM_TEMP';
}

// --- Meal ---
export interface MealItemResponse {
  id: number;
  inventoryId: number;
  itemName: string;
  quantityUsed: number;
  estimatedCost: number;
}

export interface MealResponse {
  id: number;
  mealDatetime: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  title: string;
  servings: number;
  note?: string;
  estimatedTotalCost: number;
  costPerServing: number;
  items: MealItemResponse[];
}

export interface MealItemRequest {
  inventoryId: number;
  quantityUsed: number;
}

export interface MealRequest {
  mealDatetime: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  title: string;
  servings: number;
  note?: string;
  items: MealItemRequest[];
}

// --- LLM設定（ユーザごとのAPIキー） ---
export interface LlmConfigResponse {
  configured: boolean;
  baseUrl: string | null;
  model: string | null;
  hasKey: boolean;
  maskedKey: string | null;
  supportsVision: boolean;
}

export interface LlmConfigRequest {
  baseUrl: string;
  model: string;
  apiKey?: string;       // 空なら既存キーを維持
  supportsVision: boolean;
}

// チャット用・画像(OCR)用の2系統
export type LlmPurpose = 'chat' | 'vision';

export interface LlmConfigsResponse {
  chat: LlmConfigResponse;
  vision: LlmConfigResponse;
}

// --- AIチャット ---
export interface ChatSessionResponse {
  id: number;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageResponse {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface SendMessageResponse {
  userMessage: ChatMessageResponse;
  aiMessage: ChatMessageResponse;
}

// --- 貯蓄目標・固定費 ---
export interface GoalRequest {
  targetName: string;
  targetAmount: number;
  targetDate: string;     // yyyy-MM-dd
  currentSavings: number;
}

export interface GoalResponse {
  id: number;
  targetName: string;
  targetAmount: number;
  targetDate: string;
  currentSavings: number;
}

export interface FixedCostRequest {
  name: string;
  amount: number;
  paymentDay?: number | null;
}

export interface FixedCostResponse {
  id: number;
  name: string;
  amount: number;
  paymentDay: number | null;
}

// --- シミュレーション ---
export interface GoalAchievementDates {
  achievingRate: number;
  achievable: boolean;
  estimatedOnly: boolean;
  earliest: string | null;
  optimistic: string | null;
  median: string | null;
  medianMonthsAhead: number | null;
}

export interface SimulationResult {
  startDate: string;
  goalDate: string;
  totalMonths: number;
  goalAmount: number;
  currentSavings: number;
  monthlyIncome: number;
  fixedExpense: number;
  variableExpense: number;
  monthlySurplus: number;
  neededMonthlySavings: number;
  achievementRate: number;
  labels: string[];
  snapDates: string[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  finalP10: number;
  finalP50: number;
  finalP90: number;
  goalAchievementDates: GoalAchievementDates;
}

// --- レシートOCR ---
export interface ReceiptItem {
  name: string;
  price: number | null;
}

export interface ReceiptDraft {
  entryDate: string | null;
  totalAmount: number | null;
  storeName: string | null;
  suggestedCategoryName: string | null;
  items: ReceiptItem[] | null;
}
