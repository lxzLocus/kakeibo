package com.study.kakeibo.service.impl;

import com.study.kakeibo.dto.Response.AnalyticsResponseDto;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto.CategorySummary;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto.StoreSummary;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto.DailySummary;
import com.study.kakeibo.dto.Response.TrendResponseDto;
import com.study.kakeibo.dto.Response.TrendResponseDto.CategoryTrend;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.AnalyticsService;
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
