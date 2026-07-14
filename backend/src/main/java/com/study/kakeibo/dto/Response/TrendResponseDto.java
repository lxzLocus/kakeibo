package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * 複数月にわたる収支・カテゴリ別支出の推移レスポンスDTO。
 * すべての配列は {@code months} と同じ順序・長さで並ぶ。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrendResponseDto {

    private List<String> months;              // ["2026-02", "2026-03", ...]（古い→新しい）
    private List<BigDecimal> monthlyIncome;   // 月ごとの収入合計
    private List<BigDecimal> monthlyExpense;  // 月ごとの支出合計
    private List<BigDecimal> monthlyBalance;  // 月ごとの収支（収入 - 支出）
    private List<CategoryTrend> categories;   // カテゴリ別の月次支出推移（合計の大きい順）

    // --- カテゴリ別の推移 ---
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CategoryTrend {
        private Long categoryId;
        private String name;
        private List<BigDecimal> monthly;     // months と同順の月次支出
        private BigDecimal total;             // 期間合計
    }
}
