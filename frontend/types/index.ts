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
}

export interface CategoryResponse {
  id: number;
  name: string;
  createdAt: string;
}

// --- Store ---
export interface StoreRequest {
  name: string;
  type?: string | null;
}

export interface StoreResponse {
  id: number;
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
