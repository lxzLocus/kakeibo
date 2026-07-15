package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 「分析する」ボタン用の、コードベース（LLM不使用）の分析結果。
 * 選択月の支出を、ユーザー自身の過去の平均・中央値と比較する。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalysisResponseDto {

    private String month;                 // "2026-07"
    private int monthsAnalyzed;           // 比較に使った過去の月数
    private long totalExpense;            // 選択月の支出合計
    private long avgMonthlyExpense;       // 過去の月次支出の平均
    private long medianMonthlyExpense;    // 過去の月次支出の中央値
    private Double totalVsAvgPct;         // 平均比 %（過去データが無ければ null）
    private List<CategoryComparison> categories; // カテゴリ別の平均比較（金額降順）
    private List<String> highlights;      // コード生成の短い所見

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CategoryComparison {
        private String name;
        private long amount;        // 選択月の金額
        private long avgAmount;     // そのカテゴリの過去月次平均
        private Double diffPct;     // 平均比 %（過去が無ければ null）
        private String direction;   // "up" | "down" | "flat" | "new"
    }
}
