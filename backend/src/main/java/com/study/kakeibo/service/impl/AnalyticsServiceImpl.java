package com.study.kakeibo.service.impl;

import com.study.kakeibo.dto.Response.AnalysisResponseDto;
import com.study.kakeibo.dto.Response.AnalysisResponseDto.CategoryComparison;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto.CategorySummary;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto.StoreSummary;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto.DailySummary;
import com.study.kakeibo.dto.Response.BenchmarkResponseDto;
import com.study.kakeibo.dto.Response.BenchmarkResponseDto.BenchmarkItem;
import com.study.kakeibo.dto.Response.TrendResponseDto;
import com.study.kakeibo.dto.Response.TrendResponseDto.CategoryTrend;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.AnalyticsService;
import com.study.kakeibo.service.benchmark.HouseholdBenchmarkData;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsServiceImpl implements AnalyticsService {

    private final EntryRepository entryRepository;
    private final UserRepository userRepository;

    @Autowired
    public AnalyticsServiceImpl(EntryRepository entryRepository, UserRepository userRepository) {
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
    }

    @Override
    public AnalyticsResponseDto getMonthlySummary(Long userId, int year, int month) {
        // ユーザーの存在確認
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        // 対象月の開始日・終了日
        YearMonth ym = YearMonth.of(year, month);
        LocalDate startDate = ym.atDay(1);
        LocalDate endDate = ym.atEndOfMonth();
        int daysInMonth = ym.lengthOfMonth();

        // 対象月の全エントリーを取得
        List<Entry> entries = entryRepository.findByUserAndEntryDateBetween(user, startDate, endDate);

        // --- 収入・支出の合計 ---
        BigDecimal totalIncome = entries.stream()
                .filter(e -> e.getType() == EntryType.INCOME)
                .map(Entry::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpense = entries.stream()
                .filter(e -> e.getType() == EntryType.EXPENSE)
                .map(Entry::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal balance = totalIncome.subtract(totalExpense);

        // 1日あたりの平均支出
        BigDecimal dailyAvg = totalExpense.compareTo(BigDecimal.ZERO) > 0
                ? totalExpense.divide(BigDecimal.valueOf(daysInMonth), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // --- カテゴリ別集計（支出のみ） ---
        List<CategorySummary> byCategory = buildCategorySummary(entries, totalExpense);

        // --- 店舗別集計（支出のみ） ---
        List<StoreSummary> byStore = buildStoreSummary(entries, totalExpense);

        // --- 日別推移 ---
        List<DailySummary> dailyTrend = buildDailyTrend(entries, startDate, endDate);

        return AnalyticsResponseDto.builder()
                .month(String.format("%d-%02d", year, month))
                .totalIncome(totalIncome)
                .totalExpense(totalExpense)
                .balance(balance)
                .transactionCount(entries.size())
                .dailyAverageExpense(dailyAvg)
                .byCategory(byCategory)
                .byStore(byStore)
                .dailyTrend(dailyTrend)
                .build();
    }

    @Override
    public AnalysisResponseDto analyze(Long userId, int year, int month) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        YearMonth target = YearMonth.of(year, month);
        List<Entry> all = entryRepository.findByUser(user);

        // 月ごとの支出合計 と カテゴリ別合計を集計
        Map<YearMonth, Long> monthlyExpense = new HashMap<>();
        Map<YearMonth, Map<String, Long>> monthlyCat = new HashMap<>();
        for (Entry e : all) {
            if (e.getType() != EntryType.EXPENSE || e.getAmount() == null) {
                continue;
            }
            YearMonth ym = YearMonth.from(e.getEntryDate());
            long amt = e.getAmount().longValue();
            monthlyExpense.merge(ym, amt, Long::sum);
            String cat = e.getCategory() != null ? e.getCategory().getName() : "その他";
            monthlyCat.computeIfAbsent(ym, k -> new HashMap<>()).merge(cat, amt, Long::sum);
        }

        long targetTotal = monthlyExpense.getOrDefault(target, 0L);

        // baseline = 対象月以外の月次支出
        List<Long> baseline = monthlyExpense.entrySet().stream()
                .filter(en -> !en.getKey().equals(target))
                .map(Map.Entry::getValue)
                .sorted()
                .collect(Collectors.toList());
        int monthsAnalyzed = baseline.size();
        long avg = monthsAnalyzed > 0
                ? Math.round(baseline.stream().mapToLong(Long::longValue).average().orElse(0)) : 0;
        long median = monthsAnalyzed > 0 ? baseline.get(monthsAnalyzed / 2) : 0;
        Double totalVsAvgPct = (monthsAnalyzed > 0 && avg > 0)
                ? (targetTotal - avg) * 100.0 / avg : null;

        // カテゴリ別: 対象月 vs 過去平均（そのカテゴリが出た月の平均）
        Map<String, List<Long>> catHistory = new HashMap<>();
        for (Map.Entry<YearMonth, Map<String, Long>> en : monthlyCat.entrySet()) {
            if (en.getKey().equals(target)) {
                continue;
            }
            for (Map.Entry<String, Long> c : en.getValue().entrySet()) {
                catHistory.computeIfAbsent(c.getKey(), k -> new ArrayList<>()).add(c.getValue());
            }
        }
        List<CategoryComparison> categories = new ArrayList<>();
        for (Map.Entry<String, Long> c : monthlyCat.getOrDefault(target, Map.of()).entrySet()) {
            long amt = c.getValue();
            List<Long> hist = catHistory.getOrDefault(c.getKey(), List.of());
            long catAvg = hist.isEmpty() ? 0
                    : Math.round(hist.stream().mapToLong(Long::longValue).average().orElse(0));
            Double diffPct = catAvg > 0 ? (amt - catAvg) * 100.0 / catAvg : null;
            String dir = hist.isEmpty() ? "new"
                    : diffPct == null ? "flat"
                    : diffPct > 10 ? "up"
                    : diffPct < -10 ? "down" : "flat";
            categories.add(CategoryComparison.builder()
                    .name(c.getKey()).amount(amt).avgAmount(catAvg).diffPct(diffPct).direction(dir).build());
        }
        categories.sort((a, b) -> Long.compare(b.getAmount(), a.getAmount()));

        // 所見（テンプレ・LLM不使用）
        List<String> highlights = new ArrayList<>();
        if (monthsAnalyzed == 0) {
            highlights.add("比較できる過去データがまだありません。数ヶ月記録すると平均・中央値との比較ができます。");
        } else {
            if (totalVsAvgPct != null) {
                String w = totalVsAvgPct >= 5 ? "高め"
                        : totalVsAvgPct <= -5 ? "低め（抑えられています）" : "平均並み";
                highlights.add(String.format("この月の支出は平均より %+.0f%%（%s）。", totalVsAvgPct, w));
            }
            categories.stream()
                    .filter(c -> "up".equals(c.getDirection()) && c.getDiffPct() != null)
                    .sorted((a, b) -> Double.compare(b.getDiffPct(), a.getDiffPct()))
                    .limit(2)
                    .forEach(c -> highlights.add(
                            String.format("%s が平均より %+.0f%% 増えています。", c.getName(), c.getDiffPct())));
            categories.stream()
                    .filter(c -> "down".equals(c.getDirection()) && c.getDiffPct() != null)
                    .sorted((a, b) -> Double.compare(a.getDiffPct(), b.getDiffPct()))
                    .limit(2)
                    .forEach(c -> highlights.add(
                            String.format("%s は平均より %+.0f%% 抑えられています。", c.getName(), c.getDiffPct())));
        }

        return AnalysisResponseDto.builder()
                .month(String.format("%d-%02d", year, month))
                .monthsAnalyzed(monthsAnalyzed)
                .totalExpense(targetTotal)
                .avgMonthlyExpense(avg)
                .medianMonthlyExpense(median)
                .totalVsAvgPct(totalVsAvgPct)
                .categories(categories)
                .highlights(highlights)
                .build();
    }

    @Override
    public BenchmarkResponseDto getBenchmark(Long userId, int year, int month, String ageGroup, String household) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        String hh = HouseholdBenchmarkData.normalizeHousehold(household);
        String age = (ageGroup != null && HouseholdBenchmarkData.AGE_GROUPS.contains(ageGroup)) ? ageGroup : null;

        YearMonth target = YearMonth.of(year, month);
        List<Entry> all = entryRepository.findByUser(user);

        // 当月の支出を 10大費目 に寄せて集計
        long[] catAmount = new long[HouseholdBenchmarkData.CATEGORIES.size()];
        long totalExpense = 0;
        // 直近3ヶ月（target を含む target-2..target）の収入合計
        long income3m = 0;
        YearMonth incomeFrom = target.minusMonths(2);
        for (Entry e : all) {
            if (e.getAmount() == null) continue;
            YearMonth ym = YearMonth.from(e.getEntryDate());
            long amt = e.getAmount().longValue();
            if (e.getType() == EntryType.EXPENSE && ym.equals(target)) {
                int idx = HouseholdBenchmarkData.categoryIndex(
                        e.getCategory() != null ? e.getCategory().getName() : null);
                catAmount[idx] += amt;
                totalExpense += amt;
            } else if (e.getType() == EntryType.INCOME
                    && !ym.isBefore(incomeFrom) && !ym.isAfter(target)) {
                income3m += amt;
            }
        }

        Long avgIncome3m = income3m > 0 ? Math.round(income3m / 3.0) : null;
        Double spendingRate = (avgIncome3m != null && avgIncome3m > 0)
                ? Math.round(totalExpense * 1000.0 / avgIncome3m) / 10.0 : null;
        String incomeBand = avgIncome3m != null
                ? HouseholdBenchmarkData.incomeBandLabel(hh, avgIncome3m) : null;

        List<BenchmarkItem> byAge = buildComparison(catAmount, totalExpense,
                HouseholdBenchmarkData.byAge(hh, age));
        List<BenchmarkItem> byIncome = buildComparison(catAmount, totalExpense,
                HouseholdBenchmarkData.byIncome(hh, incomeBand));

        return BenchmarkResponseDto.builder()
                .month(String.format("%d-%02d", year, month))
                .household(hh)
                .ageGroup(age)
                .totalExpense(totalExpense)
                .avgIncome3m(avgIncome3m)
                .spendingRate(spendingRate)
                .incomeBand(incomeBand)
                .sourceNote(HouseholdBenchmarkData.SOURCE_NOTE)
                .byAge(byAge)
                .byIncome(byIncome)
                .build();
    }

    /**
     * ユーザーの費目別金額と、参照平均の構成比(%)を突き合わせて比較行を作る。
     * 参照が無い（年代未設定・収入不明）または当月支出0なら空リストを返す。
     * 参照の合計が100でなくても、正規化してから比較する。
     */
    private List<BenchmarkItem> buildComparison(long[] catAmount, long totalExpense, double[] refShares) {
        if (refShares == null || totalExpense <= 0) {
            return List.of();
        }
        double refSum = 0;
        for (double v : refShares) refSum += v;
        if (refSum <= 0) return List.of();

        List<String> names = HouseholdBenchmarkData.CATEGORIES;
        List<BenchmarkItem> items = new ArrayList<>(names.size());
        for (int i = 0; i < names.size(); i++) {
            double userPct = catAmount[i] * 100.0 / totalExpense;
            double avgPct = refShares[i] * 100.0 / refSum;
            items.add(BenchmarkItem.builder()
                    .category(names.get(i))
                    .amount(catAmount[i])
                    .userPct(Math.round(userPct * 10) / 10.0)
                    .avgPct(Math.round(avgPct * 10) / 10.0)
                    .diffPct(Math.round((userPct - avgPct) * 10) / 10.0)
                    .build());
        }
        // ユーザーの金額が大きい費目を上に
        items.sort((a, b) -> Long.compare(b.getAmount(), a.getAmount()));
        return items;
    }

    @Override
    public TrendResponseDto getTrend(Long userId, int year, int month, int months) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        int span = Math.max(1, Math.min(24, months));
        YearMonth anchor = YearMonth.of(year, month);
        YearMonth first = anchor.minusMonths(span - 1L);

        LocalDate startDate = first.atDay(1);
        LocalDate endDate = anchor.atEndOfMonth();

        List<Entry> entries = entryRepository.findByUserAndEntryDateBetween(user, startDate, endDate);

        // 月ラベルと、月→インデックスの対応
        List<String> monthLabels = new ArrayList<>(span);
        Map<YearMonth, Integer> monthIndex = new HashMap<>();
        for (int i = 0; i < span; i++) {
            YearMonth ym = first.plusMonths(i);
            monthLabels.add(ym.toString());   // "2026-02"
            monthIndex.put(ym, i);
        }

        BigDecimal[] income = zeroArray(span);
        BigDecimal[] expense = zeroArray(span);
        Map<Long, BigDecimal[]> categoryMonthly = new HashMap<>();
        Map<Long, String> categoryName = new HashMap<>();

        for (Entry e : entries) {
            Integer i = monthIndex.get(YearMonth.from(e.getEntryDate()));
            if (i == null) continue;
            BigDecimal amount = e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO;

            if (e.getType() == EntryType.INCOME) {
                income[i] = income[i].add(amount);
            } else if (e.getType() == EntryType.EXPENSE) {
                expense[i] = expense[i].add(amount);
                if (e.getCategory() != null) {
                    Long cid = e.getCategory().getId();
                    categoryName.putIfAbsent(cid, e.getCategory().getName());
                    BigDecimal[] arr = categoryMonthly.computeIfAbsent(cid, k -> zeroArray(span));
                    arr[i] = arr[i].add(amount);
                }
            }
        }

        List<BigDecimal> balance = new ArrayList<>(span);
        for (int i = 0; i < span; i++) {
            balance.add(income[i].subtract(expense[i]));
        }

        List<CategoryTrend> categories = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal[]> en : categoryMonthly.entrySet()) {
            BigDecimal[] arr = en.getValue();
            BigDecimal total = BigDecimal.ZERO;
            for (BigDecimal v : arr) total = total.add(v);
            categories.add(CategoryTrend.builder()
                    .categoryId(en.getKey())
                    .name(categoryName.get(en.getKey()))
                    .monthly(Arrays.asList(arr))
                    .total(total)
                    .build());
        }
        // 期間合計の大きい順
        categories.sort((a, b) -> b.getTotal().compareTo(a.getTotal()));

        return TrendResponseDto.builder()
                .months(monthLabels)
                .monthlyIncome(Arrays.asList(income))
                .monthlyExpense(Arrays.asList(expense))
                .monthlyBalance(balance)
                .categories(categories)
                .build();
    }

    /** 長さ n の BigDecimal 配列を 0 で初期化して返す。 */
    private BigDecimal[] zeroArray(int n) {
        BigDecimal[] arr = new BigDecimal[n];
        Arrays.fill(arr, BigDecimal.ZERO);
        return arr;
    }

    /**
     * カテゴリ別支出サマリーを構築する
     */
    private List<CategorySummary> buildCategorySummary(List<Entry> entries, BigDecimal totalExpense) {
        // 支出のみを対象にカテゴリでグルーピング
        Map<Long, List<Entry>> grouped = entries.stream()
                .filter(e -> e.getType() == EntryType.EXPENSE)
                .collect(Collectors.groupingBy(e -> e.getCategory().getId()));

        List<CategorySummary> result = new ArrayList<>();
        for (Map.Entry<Long, List<Entry>> entry : grouped.entrySet()) {
            List<Entry> catEntries = entry.getValue();
            BigDecimal amount = catEntries.stream()
                    .map(Entry::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            double pct = totalExpense.compareTo(BigDecimal.ZERO) > 0
                    ? amount.multiply(BigDecimal.valueOf(100))
                            .divide(totalExpense, 1, RoundingMode.HALF_UP)
                            .doubleValue()
                    : 0;

            result.add(CategorySummary.builder()
                    .categoryId(entry.getKey())
                    .name(catEntries.get(0).getCategory().getName())
                    .amount(amount)
                    .percentage(pct)
                    .transactionCount(catEntries.size())
                    .build());
        }

        // 金額の大きい順にソート
        result.sort((a, b) -> b.getAmount().compareTo(a.getAmount()));
        return result;
    }

    /**
     * 店舗別支出サマリーを構築する
     */
    private List<StoreSummary> buildStoreSummary(List<Entry> entries, BigDecimal totalExpense) {
        // 支出のみ & 店舗が設定されているもの
        Map<Long, List<Entry>> grouped = entries.stream()
                .filter(e -> e.getType() == EntryType.EXPENSE && e.getStore() != null)
                .collect(Collectors.groupingBy(e -> e.getStore().getId()));

        List<StoreSummary> result = new ArrayList<>();
        for (Map.Entry<Long, List<Entry>> entry : grouped.entrySet()) {
            List<Entry> storeEntries = entry.getValue();
            BigDecimal amount = storeEntries.stream()
                    .map(Entry::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            double pct = totalExpense.compareTo(BigDecimal.ZERO) > 0
                    ? amount.multiply(BigDecimal.valueOf(100))
                            .divide(totalExpense, 1, RoundingMode.HALF_UP)
                            .doubleValue()
                    : 0;

            result.add(StoreSummary.builder()
                    .storeId(entry.getKey())
                    .name(storeEntries.get(0).getStore().getName())
                    .amount(amount)
                    .percentage(pct)
                    .transactionCount(storeEntries.size())
                    .build());
        }

        // 金額の大きい順にソート
        result.sort((a, b) -> b.getAmount().compareTo(a.getAmount()));
        return result;
    }

    /**
     * 日別の収入・支出推移データを構築する
     */
    private List<DailySummary> buildDailyTrend(List<Entry> entries, LocalDate startDate, LocalDate endDate) {
        // 日付ごとにグルーピング
        Map<LocalDate, List<Entry>> grouped = entries.stream()
                .collect(Collectors.groupingBy(Entry::getEntryDate));

        List<DailySummary> result = new ArrayList<>();
        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            List<Entry> dayEntries = grouped.getOrDefault(current, Collections.emptyList());

            BigDecimal dayIncome = dayEntries.stream()
                    .filter(e -> e.getType() == EntryType.INCOME)
                    .map(Entry::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal dayExpense = dayEntries.stream()
                    .filter(e -> e.getType() == EntryType.EXPENSE)
                    .map(Entry::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            result.add(DailySummary.builder()
                    .date(current)
                    .income(dayIncome)
                    .expense(dayExpense)
                    .build());

            current = current.plusDays(1);
        }
        return result;
    }
}
