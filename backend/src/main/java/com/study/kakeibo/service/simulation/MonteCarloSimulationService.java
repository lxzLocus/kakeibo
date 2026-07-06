package com.study.kakeibo.service.simulation;

import com.study.kakeibo.dto.Response.SimulationResultDto;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * モンテカルロ方式の貯蓄目標シミュレーション（純粋な数学・LLM不使用）。
 * 参照アプリ osaifu の MonteCarloSimulationServiceImpl を移植。
 * パーソナリティ診断は本アプリでは未導入のため、補正係数はニュートラル固定とする。
 */
@Service
public class MonteCarloSimulationService {

    private static final int SIMULATION_COUNT = 2_000;

    // --- ニュートラル補正係数（性格診断なし） ---
    private static final double SAVING_RATE_ADJ = 1.0;
    private static final double VARIANCE_ADJ = 1.0;
    private static final double IMPULSE_PROB = 0.15;
    private static final double IMPULSE_SIZE_ADJ = 1.0;
    private static final double ILLNESS_COST_ADJ = 1.0;

    /** 年齢帯別の病気リスク表: [年齢下限, 年齢上限, 年間発生率%, コスト下限, コスト上限] */
    private static final long[][] AGE_RISK = {
            {20, 29, 4, 50_000, 300_000},
            {30, 39, 6, 80_000, 500_000},
            {40, 49, 10, 150_000, 1_000_000},
            {50, 59, 16, 250_000, 1_500_000},
            {60, 69, 24, 400_000, 2_500_000},
            {70, 99, 35, 600_000, 4_000_000},
    };
    private static final int ILLNESS_COST_MIN_COLUMN = 3;
    private static final int ILLNESS_COST_MAX_COLUMN = 4;
    private static final double[] AGE_ANNUAL_PROB = {0.04, 0.06, 0.10, 0.16, 0.24, 0.35};
    private static final Random RANDOM = new Random();

    /** 季節イベントによる変動費への追加出費割合 */
    private static final Map<Integer, Double> SEASONAL_EXPENSE_RATE = Map.of(
            1, 0.40, 5, 0.50, 8, 0.30, 12, 0.60);
    private static final double SEASONAL_EXPENSE_RATE_ANNUAL_SUM =
            SEASONAL_EXPENSE_RATE.values().stream().mapToDouble(Double::doubleValue).sum();

    /**
     * シミュレーション入力。
     */
    public record SimulationInput(
            LocalDate startDate,
            LocalDate goalDate,
            int currentAge,
            double currentSavings,
            double goalAmount,
            double monthlyIncome,
            double fixedExpense,
            double variableExpense,
            double expenseVolatility,
            double insuranceCoverageRate) {
    }

    public SimulationResultDto simulate(SimulationInput in) {
        int totalMonths = (int) ChronoUnit.MONTHS.between(in.startDate(), in.goalDate());
        if (totalMonths <= 0) {
            throw new IllegalArgumentException("目標日は現在より後の日付を指定してください。");
        }

        double monthlyVolatility = in.expenseVolatility() > 0
                ? in.expenseVolatility() : in.variableExpense() * 0.35;

        double avgMonthlySeasonalDrag = in.variableExpense()
                * SEASONAL_EXPENSE_RATE_ANNUAL_SUM / 12.0 * VARIANCE_ADJ;
        double avgMonthlyImpulseDrag = 0.4 * IMPULSE_PROB * IMPULSE_SIZE_ADJ * in.variableExpense();

        int snapshotInterval = Math.max(1, (int) Math.ceil(totalMonths / 48.0));
        List<Integer> snapshotOffsets = buildSnapshotOffsets(totalMonths, snapshotInterval);
        int snapshotCount = snapshotOffsets.size();

        double[][] simulatedPaths = new double[SIMULATION_COUNT][snapshotCount];
        int[] goalHitMonths = new int[SIMULATION_COUNT];
        Arrays.fill(goalHitMonths, -1);
        int achievedCount = 0;

        for (int simIndex = 0; simIndex < SIMULATION_COUNT; simIndex++) {
            double balance = in.currentSavings();
            boolean reachedGoal = false;
            int snapshotIndex = 0;
            simulatedPaths[simIndex][snapshotIndex++] = balance;

            for (int month = 1; month <= totalMonths; month++) {
                int ageAtMonth = (int) (in.currentAge() + month / 12.0);
                int riskBandIndex = riskBandIndex(ageAtMonth);

                double monthlySurplus = in.monthlyIncome() - in.fixedExpense() - in.variableExpense();
                double plannedMonthlySaving = monthlySurplus * SAVING_RATE_ADJ;
                double volatilityNoise = (RANDOM.nextDouble() * 2 - 1) * monthlyVolatility * VARIANCE_ADJ;
                double impulseSpending = RANDOM.nextDouble() < IMPULSE_PROB
                        ? -(RANDOM.nextDouble() * in.variableExpense() * 0.8 * IMPULSE_SIZE_ADJ) : 0;

                int calendarMonth = in.startDate().plusMonths(month - 1).getMonthValue();
                double seasonalAddRate = SEASONAL_EXPENSE_RATE.getOrDefault(calendarMonth, 0.0);
                double seasonalExpense = seasonalAddRate > 0
                        ? in.variableExpense() * seasonalAddRate * (0.7 + RANDOM.nextDouble() * 0.6) * VARIANCE_ADJ
                        : 0;

                balance += plannedMonthlySaving
                        + avgMonthlySeasonalDrag + avgMonthlyImpulseDrag
                        - volatilityNoise + impulseSpending - seasonalExpense;

                if (RANDOM.nextDouble() < AGE_ANNUAL_PROB[riskBandIndex] / 12.0) {
                    double minCost = AGE_RISK[riskBandIndex][ILLNESS_COST_MIN_COLUMN];
                    double maxCost = AGE_RISK[riskBandIndex][ILLNESS_COST_MAX_COLUMN];
                    double grossIllnessCost = (minCost + RANDOM.nextDouble() * (maxCost - minCost)) * ILLNESS_COST_ADJ;
                    long illnessSelfPay = Math.round(grossIllnessCost * (1.0 - in.insuranceCoverageRate()));
                    balance -= illnessSelfPay;
                }

                if (balance < 0) balance = 0;

                if (!reachedGoal && balance >= in.goalAmount()) {
                    reachedGoal = true;
                    goalHitMonths[simIndex] = month;
                }

                if (snapshotIndex < snapshotCount && month == snapshotOffsets.get(snapshotIndex)) {
                    simulatedPaths[simIndex][snapshotIndex++] = balance;
                }
            }
            while (snapshotIndex < snapshotCount) simulatedPaths[simIndex][snapshotIndex++] = balance;
            if (reachedGoal) achievedCount++;
        }

        double[][] percentilePaths = calcPercentiles(simulatedPaths, snapshotCount);

        double effectiveMonthlySaving =
                (in.monthlyIncome() - in.fixedExpense() - in.variableExpense()) * SAVING_RATE_ADJ;
        SimulationResultDto.GoalAchievementDates achievementDates = calcAchievementDates(
                goalHitMonths, in.startDate(), in.goalDate(), totalMonths,
                effectiveMonthlySaving, Math.round(in.currentSavings()), Math.round(in.goalAmount()));

        List<String> labels = new ArrayList<>();
        List<LocalDate> snapDates = new ArrayList<>();
        for (int monthOffset : snapshotOffsets) {
            LocalDate snapshotDate = in.startDate().plusMonths(monthOffset);
            snapDates.add(snapshotDate);
            labels.add(buildLabel(monthOffset, totalMonths, snapshotDate));
        }

        long monthlySurplus = Math.round(in.monthlyIncome() - in.fixedExpense() - in.variableExpense());
        long neededMonthlySavings = totalMonths > 0
                ? Math.round((in.goalAmount() - in.currentSavings()) / totalMonths) : 0;

        return SimulationResultDto.builder()
                .startDate(in.startDate())
                .goalDate(in.goalDate())
                .totalMonths(totalMonths)
                .goalAmount(Math.round(in.goalAmount()))
                .currentSavings(Math.round(in.currentSavings()))
                .monthlyIncome(Math.round(in.monthlyIncome()))
                .fixedExpense(Math.round(in.fixedExpense()))
                .variableExpense(Math.round(in.variableExpense()))
                .monthlySurplus(monthlySurplus)
                .neededMonthlySavings(neededMonthlySavings)
                .achievementRate(Math.round((double) achievedCount / SIMULATION_COUNT * 100))
                .labels(labels)
                .snapDates(snapDates)
                .p10(toLongList(percentilePaths[0])).p25(toLongList(percentilePaths[1])).p50(toLongList(percentilePaths[2]))
                .p75(toLongList(percentilePaths[3])).p90(toLongList(percentilePaths[4]))
                .finalP10(Math.round(percentilePaths[0][snapshotCount - 1]))
                .finalP50(Math.round(percentilePaths[2][snapshotCount - 1]))
                .finalP90(Math.round(percentilePaths[4][snapshotCount - 1]))
                .goalAchievementDates(achievementDates)
                .build();
    }

    private SimulationResultDto.GoalAchievementDates calcAchievementDates(
            int[] goalHitMonths, LocalDate startDate, LocalDate goalDate, int totalMonths,
            double effectiveMonthlySaving, long currentSavings, long goalAmount) {

        int[] achievedMonths = Arrays.stream(goalHitMonths).filter(m -> m > 0).sorted().toArray();
        int achievedCount = achievedMonths.length;
        long achievingRate = Math.round((double) achievedCount / SIMULATION_COUNT * 100);

        if (achievedCount == 0) {
            if (effectiveMonthlySaving <= 0) {
                return SimulationResultDto.GoalAchievementDates.builder()
                        .achievingRate(0L).achievable(false).estimatedOnly(false).build();
            }
            long remainingShortfall = goalAmount - currentSavings;
            int estimatedExtraMonths = (int) Math.ceil((double) remainingShortfall / effectiveMonthlySaving);
            LocalDate estimatedDate = startDate.plusMonths((long) totalMonths + estimatedExtraMonths);
            long monthsAfterGoal = ChronoUnit.MONTHS.between(goalDate, estimatedDate);
            return SimulationResultDto.GoalAchievementDates.builder()
                    .achievingRate(0L).achievable(true).estimatedOnly(true)
                    .earliest(estimatedDate).optimistic(estimatedDate).median(estimatedDate)
                    .medianMonthsAhead((int) -monthsAfterGoal)
                    .build();
        }

        int indexP10 = Math.min((int) (achievedCount * 0.10), achievedCount - 1);
        int indexP25 = Math.min((int) (achievedCount * 0.25), achievedCount - 1);
        int indexP50 = Math.min((int) (achievedCount * 0.50), achievedCount - 1);

        LocalDate dateP10 = startDate.plusMonths(achievedMonths[indexP10]);
        LocalDate dateP25 = startDate.plusMonths(achievedMonths[indexP25]);
        LocalDate dateP50 = startDate.plusMonths(achievedMonths[indexP50]);

        return SimulationResultDto.GoalAchievementDates.builder()
                .achievingRate(achievingRate).achievable(true).estimatedOnly(false)
                .earliest(dateP10).optimistic(dateP25).median(dateP50)
                .medianMonthsAhead((int) ChronoUnit.MONTHS.between(dateP50, goalDate))
                .build();
    }

    private List<Integer> buildSnapshotOffsets(int totalMonths, int snapshotInterval) {
        List<Integer> offsets = new ArrayList<>();
        for (int month = 0; month <= totalMonths; month += snapshotInterval) offsets.add(month);
        if (!offsets.get(offsets.size() - 1).equals(totalMonths)) offsets.add(totalMonths);
        return offsets;
    }

    private String buildLabel(int monthOffset, int totalMonths, LocalDate date) {
        DateTimeFormatter ym = DateTimeFormatter.ofPattern("yyyy/MM");
        if (monthOffset == 0) return date.format(ym);
        if (totalMonths <= 6) return date.format(ym);
        if (totalMonths <= 24) return monthOffset % 2 == 0 ? date.format(ym) : "";
        return date.getMonthValue() == 1 ? date.getYear() + "年" : "";
    }

    private double[][] calcPercentiles(double[][] simulatedPaths, int snapshotCount) {
        double[][] percentiles = new double[5][snapshotCount];
        double[] columnValues = new double[SIMULATION_COUNT];
        int[] percentileIndices = {
                (int) (SIMULATION_COUNT * 0.10), (int) (SIMULATION_COUNT * 0.25),
                (int) (SIMULATION_COUNT * 0.50), (int) (SIMULATION_COUNT * 0.75),
                (int) (SIMULATION_COUNT * 0.90),
        };
        for (int snapshotIndex = 0; snapshotIndex < snapshotCount; snapshotIndex++) {
            for (int simIndex = 0; simIndex < SIMULATION_COUNT; simIndex++) {
                columnValues[simIndex] = simulatedPaths[simIndex][snapshotIndex];
            }
            Arrays.sort(columnValues);
            for (int p = 0; p < 5; p++) percentiles[p][snapshotIndex] = columnValues[percentileIndices[p]];
        }
        return percentiles;
    }

    private int riskBandIndex(int age) {
        if (age < 30) return 0;
        if (age < 40) return 1;
        if (age < 50) return 2;
        if (age < 60) return 3;
        if (age < 70) return 4;
        return 5;
    }

    private List<Long> toLongList(double[] values) {
        List<Long> list = new ArrayList<>(values.length);
        for (double value : values) list.add(Math.round(value));
        return list;
    }
}
