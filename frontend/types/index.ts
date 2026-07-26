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
  groupName: string | null;   // グループ（プライマリ）。未分類は null
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
  memo?: string | null;   // 品名（購入した物・明細）
  note?: string | null;   // 自由記入のメモ
  fundPoolId?: number | null;      // 紐づける口座（null は主口座）
  excludeFromSimulation?: boolean; // シミュレーション学習から除外（手持ち調整用など）
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
  memo: string | null;   // 品名（購入した物・明細）
  note: string | null;   // 自由記入のメモ
  fundPoolId: number | null;
  excludeFromSimulation: boolean; // シミュレーション学習から除外
}

// --- 資金プール（口座）・振替 ---
export type FundPoolKind = 'BANK' | 'CASH' | 'CARD';

export interface FundPoolResponse {
  id: number;
  name: string;
  initialBalance: number;
  balance: number;          // 開始残高 + 収支 + 振替 の現在残高（カードは未払い額が負で出る）
  primary: boolean;
  sortOrder: number;
  kind: FundPoolKind;       // 銀行 / 現金 / カード
  color: string | null;     // カードのブランドカラー等（16進）
  // カード(kind=CARD)の引き落とし設定
  closingDay: number | null;      // 締め日（null=月末）
  paymentDay: number | null;      // 引き落とし日
  settlementPoolId: number | null; // 引き落とし元口座
  autoSettle: boolean;             // 自動引き落とし
}

export interface TransferResponse {
  id: number;
  fromPoolId: number;
  fromPoolName: string;
  toPoolId: number;
  toPoolName: string;
  amount: number;
  transferDate: string;     // yyyy-MM-dd
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

// 複数月にわたる収支・カテゴリ別支出の推移
export interface CategoryTrend {
  categoryId: number;
  name: string;
  monthly: number[];       // months と同順の月次支出
  total: number;           // 期間合計
}

export interface TrendSummary {
  months: string[];        // ["2026-02", ...]（古い→新しい）
  monthlyIncome: number[];
  monthlyExpense: number[];
  monthlyBalance: number[];
  categories: CategoryTrend[];
}

// 「分析する」: 平均・中央値との比較（コードベース）
export interface AnalysisCategoryComparison {
  name: string;
  amount: number;
  avgAmount: number;
  diffPct: number | null;
  direction: 'up' | 'down' | 'flat' | 'new';
}

export interface AnalysisResult {
  month: string;
  monthsAnalyzed: number;
  totalExpense: number;
  avgMonthlyExpense: number;
  medianMonthlyExpense: number;
  totalVsAvgPct: number | null;
  categories: AnalysisCategoryComparison[];
  highlights: string[];
}

// 「世帯平均との比較」: 家計調査ベースの概算参照値との比較
export interface BenchmarkItem {
  category: string;   // 10大費目名
  amount: number;     // ユーザーの当月金額
  userPct: number;    // ユーザーの構成比(%)
  avgPct: number;     // 参照平均の構成比(%)
  diffPct: number;    // userPct - avgPct（ポイント差）
}

export interface BenchmarkResult {
  month: string;
  household: 'SINGLE' | 'FAMILY';
  ageGroup: string | null;
  totalExpense: number;
  avgIncome3m: number | null;   // 直近3ヶ月平均収入
  spendingRate: number | null;  // 支出/収入 %
  incomeBand: string | null;
  sourceNote: string;
  byAge: BenchmarkItem[];
  byIncome: BenchmarkItem[];
}

// 評価バッチの設定・状態
export type EvaluationFrequency = 'OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export interface EvaluationResponse {
  frequency: EvaluationFrequency;
  lastRunAt: string | null;
  summary: string | null;
}

// --- Import ---
export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  createdEntryIds: number[];
}

export interface ImportRow {
  line: number;
  status: 'OK' | 'WARNING' | 'ERROR';
  message: string | null;
  date: string;
  amount: number | null;
  type: 'INCOME' | 'EXPENSE' | null;
  category: string | null;
  newCategory: boolean;
  store: string | null;
  newStore: boolean;
  memo: string | null;
  note: string | null;
  pool: string | null;
  excludeFromSimulation: boolean;
}

export interface ImportPreview {
  totalRows: number;
  okCount: number;
  warningCount: number;
  errorCount: number;
  headerError: string | null;
  rows: ImportRow[];
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
  directOcr: boolean;    // レシート読取: true=画像を直接LLM / false=OCR→LLM（vision用）
}

export interface LlmConfigRequest {
  baseUrl: string;
  model: string;
  apiKey?: string;       // 空なら既存キーを維持
  supportsVision: boolean;
  directOcr: boolean;
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
  reasoning?: string; // 推論モデルの思考過程（ストリーミング中のみ・永続化しない）
}

export interface SendMessageResponse {
  userMessage: ChatMessageResponse;
  aiMessage: ChatMessageResponse;
  relatedQuestions?: string[];
}

// --- 管理ビュー（裏で自動管理しているデータの参照） ---
export interface AdminOverview {
  counts: {
    entries: number; categories: number; stores: number; pools: number;
    transfers: number; fixedCosts: number; chatSessions: number;
  };
  llm: {
    purpose: string; configured: boolean; model: string | null; baseUrl: string | null;
    supportsVision: boolean; supportsTools: boolean | null; directOcr: boolean;
  }[];
  memory: { present: boolean; length: number; updatedAt: string | null };
  evaluation: { frequency: string; lastRunAt: string | null };
  automation: { fixedCostPostedEntries: number; cardSettlementTransfers: number };
  pools: {
    id: number; name: string; kind: string; primary: boolean;
    closingDay: number | null; paymentDay: number | null;
    settlementPoolId: number | null; autoSettle: boolean;
  }[];
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
  /** 毎月この固定費を収支へ自動記帳するか */
  autoPost?: boolean;
  /** 自動記帳先カテゴリ。未指定なら「固定費」カテゴリ */
  categoryId?: number | null;
  /** 支払い元プール（口座/カード）。未指定は主口座 */
  paymentPoolId?: number | null;
}

export interface FixedCostResponse {
  id: number;
  name: string;
  amount: number;
  paymentDay: number | null;
  autoPost: boolean;
  categoryId: number | null;
  paymentPoolId: number | null;
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

// --- 買い物リスト ---
export interface ShoppingItemResponse {
  id: number;
  name: string;
  quantity: string | null;
  estimatedPrice: number | null;
  checked: boolean;
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
  memo: string | null;        // 品名（「店舗\n商品, 値段」形式・バックエンドで構築）
}
