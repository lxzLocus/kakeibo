package com.study.kakeibo.dto.Response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 月次分析サマリーのレスポンスDTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalyticsResponseDto {

    private String month;                       // "2026-05"
    private BigDecimal totalIncome;              // 月間合計収入
    private BigDecimal totalExpense;             // 月間合計支出
    private BigDecimal balance;                  // 収入 - 支出
    private int transactionCount;                // 取引件数
    private BigDecimal dailyAverageExpense;      // 1日平均支出

    private List<CategorySummary> byCategory;    // カテゴリ別集計
    private List<StoreSummary> byStore;           // 店舗別集計
    private List<DailySummary> dailyTrend;        // 日別推移

    // --- カテゴリ別集計 ---
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CategorySummary {
        private Long categoryId;
        private String name;
        private BigDecimal amount;
        private double percentage;               // 支出全体に対する割合 (0-100)
        private int transactionCount;
    }

    // --- 店舗別集計 ---
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class StoreSummary {
        private Long storeId;
        private String name;
        private BigDecimal amount;
        private double percentage;               // 支出全体に対する割合 (0-100)
        private int transactionCount;
    }

    // --- 日別推移 ---
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DailySummary {
        private LocalDate date;
        private BigDecimal income;
        private BigDecimal expense;
    }
}
