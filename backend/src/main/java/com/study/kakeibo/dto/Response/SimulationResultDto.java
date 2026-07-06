package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * モンテカルロ・シミュレーション結果。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SimulationResultDto {

    private LocalDate startDate;
    private LocalDate goalDate;
    private int totalMonths;

    /** 目標額（参考表示用） */
    private long goalAmount;
    private long currentSavings;

    /** 学習した月次入力（透明性のため返す） */
    private long monthlyIncome;
    private long fixedExpense;
    private long variableExpense;
    private long monthlySurplus;
    private long neededMonthlySavings;

    /** 期限内に目標到達した試行の割合(%) */
    private long achievementRate;

    /** チャート用ラベルと各スナップショットの実日付 */
    private List<String> labels;
    private List<LocalDate> snapDates;

    /** パーセンタイル別の残高推移 */
    private List<Long> p10;
    private List<Long> p25;
    private List<Long> p50;
    private List<Long> p75;
    private List<Long> p90;

    private long finalP10;
    private long finalP50;
    private long finalP90;

    private GoalAchievementDates goalAchievementDates;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GoalAchievementDates {
        private long achievingRate;     // 期限内達成率(%)
        private boolean achievable;     // 将来的に達成可能か
        private boolean estimatedOnly;  // 実測ではなく算術推定か
        private LocalDate earliest;     // 上位10%
        private LocalDate optimistic;   // 上位25%
        private LocalDate median;       // 中央値
        private Integer medianMonthsAhead; // 目標日より何ヶ月早いか（マイナス=遅れ）
    }
}
