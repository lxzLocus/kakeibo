package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 「世帯平均との比較」の結果（LLM不使用・家計調査ベースの概算参照値）。
 * 選択月の支出構成比を、同年代平均・同収入帯平均と比較する。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BenchmarkResponseDto {

    private String month;             // "2026-07"
    private String household;         // "SINGLE" | "FAMILY"
    private String ageGroup;          // 年代（未設定なら null）
    private long totalExpense;        // 選択月の支出合計
    private Long avgIncome3m;         // 直近3ヶ月の平均収入（記録が無ければ null）
    private Double spendingRate;      // 支出 ÷ 直近3ヶ月平均収入 × 100（収入不明なら null）
    private String incomeBand;        // 判定された収入帯ラベル（収入不明なら null）
    private String sourceNote;        // 参照データの出典注記
    private List<BenchmarkItem> byAge;    // 同年代平均との費目別比較（年代未設定なら空）
    private List<BenchmarkItem> byIncome; // 同収入帯平均との費目別比較（収入不明なら空）

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BenchmarkItem {
        private String category;   // 10大費目名
        private long amount;       // ユーザーの当月金額
        private double userPct;    // ユーザーの構成比（%）
        private double avgPct;     // 参照平均の構成比（%）
        private double diffPct;    // userPct - avgPct（ポイント差）
    }
}
