package com.study.kakeibo.service;

import com.study.kakeibo.dto.Response.SimulationResultDto;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.FixedCost;
import com.study.kakeibo.entity.Goal;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.FixedCostRepository;
import com.study.kakeibo.repository.GoalRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.simulation.MonteCarloSimulationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 目標・固定費・収支(Entry)からシミュレーション入力を組み立て、モンテカルロ計算を実行する。
 * スナップショット永続化は行わない（ステートレス）。
 */
@Service
public class SimulationService {

    private static final int DEFAULT_AGE = 30;
    private static final double DEFAULT_INSURANCE_COVERAGE_RATE = 0.3;

    private final GoalRepository goalRepository;
    private final FixedCostRepository fixedCostRepository;
    private final EntryRepository entryRepository;
    private final UserRepository userRepository;
    private final MonteCarloSimulationService monteCarlo;

    public SimulationService(GoalRepository goalRepository,
                             FixedCostRepository fixedCostRepository,
                             EntryRepository entryRepository,
                             UserRepository userRepository,
                             MonteCarloSimulationService monteCarlo) {
        this.goalRepository = goalRepository;
        this.fixedCostRepository = fixedCostRepository;
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
        this.monteCarlo = monteCarlo;
    }

    /**
     * FEから調整可能なシミュレーション変数（what-if）。null のフィールドは既定（学習値/デフォルト）を使う。
     * @param age                  現在年齢（病気リスク用）。null→30歳
     * @param insuranceCoverageRate 医療保険カバー率 0.0〜1.0。null→0.3
     * @param monthlyIncome        月収の上書き。null→収入実績の平均
     * @param variableExpense      月次変動費の上書き。null→支出実績の平均
     * @param currentSavings       現在の貯蓄額の上書き（総資産連動など）。null→目標の現在貯蓄額
     */
    public record SimOverrides(Integer age, Double insuranceCoverageRate,
                               Double monthlyIncome, Double variableExpense, Double currentSavings,
                               Double illnessRiskMultiplier, Double seasonalIntensity, Double impulseIntensity) {
    }

    /**
     * 目標が設定されていれば、収支実績から学習しつつ、指定された what-if 変数で上書きして
     * シミュレーションを実行する。
     */
    @Transactional(readOnly = true)
    public SimulationResultDto runForUser(Long userId, SimOverrides overrides) {
        SimOverrides o = overrides != null ? overrides
                : new SimOverrides(null, null, null, null, null, null, null, null);

        Goal goal = goalRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("貯蓄目標が未設定です。先に目標を登録してください。"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("ユーザーが見つかりません: " + userId));

        LocalDate today = LocalDate.now();
        if (!goal.getTargetDate().isAfter(today)) {
            throw new IllegalArgumentException("目標日は今日より後の日付を指定してください。");
        }

        List<Entry> entries = entryRepository.findByUser(user);
        MonthlyStats incomeStats = monthlyStats(entries, EntryType.INCOME);
        MonthlyStats expenseStats = monthlyStats(entries, EntryType.EXPENSE);

        double fixedExpense = fixedCostRepository.findByUserIdOrderByIdAsc(userId).stream()
                .map(FixedCost::getAmount)
                .filter(a -> a != null)
                .mapToDouble(BigDecimal::doubleValue)
                .sum();

        int age = o.age() != null ? o.age() : DEFAULT_AGE;
        double insurance = o.insuranceCoverageRate() != null
                ? Math.max(0.0, Math.min(1.0, o.insuranceCoverageRate()))
                : DEFAULT_INSURANCE_COVERAGE_RATE;
        double monthlyIncome = o.monthlyIncome() != null ? Math.max(0, o.monthlyIncome()) : incomeStats.mean();
        double variableExpense = o.variableExpense() != null ? Math.max(0, o.variableExpense()) : expenseStats.mean();
        double currentSavings = o.currentSavings() != null
                ? Math.max(0, o.currentSavings())
                : goal.getCurrentSavings().doubleValue();
        double illnessMult = o.illnessRiskMultiplier() != null ? Math.max(0, o.illnessRiskMultiplier()) : 1.0;
        double seasonalMult = o.seasonalIntensity() != null ? Math.max(0, o.seasonalIntensity()) : 1.0;
        double impulseMult = o.impulseIntensity() != null ? Math.max(0, o.impulseIntensity()) : 1.0;

        MonteCarloSimulationService.SimulationInput input = new MonteCarloSimulationService.SimulationInput(
                today,
                goal.getTargetDate(),
                age,
                currentSavings,
                goal.getTargetAmount().doubleValue(),
                monthlyIncome,
                fixedExpense,
                variableExpense,
                expenseStats.std(),
                insurance,
                illnessMult,
                seasonalMult,
                impulseMult);

        return monteCarlo.simulate(input);
    }

    /**
     * 指定タイプのエントリーを年月ごとに集計し、月次合計の平均と標準偏差を返す。
     */
    private MonthlyStats monthlyStats(List<Entry> entries, EntryType type) {
        Map<YearMonth, Double> monthlyTotals = new HashMap<>();
        for (Entry e : entries) {
            if (e.getType() != type || e.getAmount() == null) continue;
            if (e.isExcludeFromSimulation()) continue; // 手持ち調整などの除外指定エントリーは学習に含めない
            YearMonth ym = YearMonth.from(e.getEntryDate());
            monthlyTotals.merge(ym, e.getAmount().doubleValue(), Double::sum);
        }
        if (monthlyTotals.isEmpty()) {
            return new MonthlyStats(0, 0);
        }
        double[] totals = monthlyTotals.values().stream().mapToDouble(Double::doubleValue).toArray();
        double mean = 0;
        for (double t : totals) mean += t;
        mean /= totals.length;
        double variance = 0;
        for (double t : totals) variance += Math.pow(t - mean, 2);
        variance /= totals.length;
        return new MonthlyStats(mean, Math.sqrt(variance));
    }

    private record MonthlyStats(double mean, double std) {
    }
}
