package com.study.kakeibo.service;

import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.FixedCost;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.CategoryRepository;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.FixedCostRepository;
import com.study.kakeibo.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * 固定費（家賃・サブスク等）を毎月の収支（Entry）へ自動記帳する。
 *
 * 設計:
 *  - 冪等: entry.fixed_cost_id + その月の範囲で既存チェックし、同じ月に二重記帳しない。
 *  - 追いつき: 固定費の作成月から当月まで、未記帳の月をまとめて記帳する（アプリを開いた時に呼ぶ）。
 *  - 未来日は作らない: 支払日がまだ来ていない月はスキップし、その日が来てから記帳される。
 *  - exclude_from_simulation=true で作る: シミュレーションは固定費を別枠(fixedExpense)で
 *    加算しているため、エントリ側も学習に含めると二重計上になる。
 */
@Service
public class FixedCostPostingService {

    /** 記帳先カテゴリが未指定のときに使う既定カテゴリ名。 */
    private static final String DEFAULT_CATEGORY = "固定費";

    private final FixedCostRepository fixedCostRepository;
    private final EntryRepository entryRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;

    public FixedCostPostingService(FixedCostRepository fixedCostRepository,
                                   EntryRepository entryRepository,
                                   CategoryRepository categoryRepository,
                                   UserRepository userRepository) {
        this.fixedCostRepository = fixedCostRepository;
        this.entryRepository = entryRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
    }

    /**
     * 自動記帳が有効な固定費について、未記帳の月ぶんのエントリを作成する。
     *
     * @return 作成したエントリ件数
     */
    @Transactional
    public int apply(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        List<FixedCost> fixedCosts = fixedCostRepository.findByUserIdOrderByIdAsc(userId);
        LocalDate today = LocalDate.now();
        YearMonth currentMonth = YearMonth.from(today);
        int created = 0;

        for (FixedCost fc : fixedCosts) {
            if (!fc.isAutoPost()) continue;
            if (fc.getAmount() == null || fc.getAmount().signum() <= 0) continue;

            Category category = resolveCategory(user, fc);

            // 固定費を登録した月から当月まで、未記帳の月を埋める
            YearMonth start = fc.getCreatedAt() != null
                    ? YearMonth.from(fc.getCreatedAt().toLocalDate())
                    : currentMonth;
            if (start.isAfter(currentMonth)) continue;

            for (YearMonth ym = start; !ym.isAfter(currentMonth); ym = ym.plusMonths(1)) {
                LocalDate postDate = postingDate(ym, fc.getPaymentDay());
                if (postDate.isAfter(today)) continue; // 支払日がまだ来ていない月は記帳しない
                if (entryRepository.existsByFixedCostIdAndEntryDateBetween(
                        fc.getId(), ym.atDay(1), ym.atEndOfMonth())) {
                    continue; // 記帳済み
                }

                Entry entry = new Entry();
                entry.setUser(user);
                entry.setEntryDate(postDate);
                entry.setAmount(fc.getAmount());
                entry.setCategory(category);
                entry.setStore(null);
                entry.setType(EntryType.EXPENSE);
                entry.setMemo(fc.getName());
                entry.setNote("固定費から自動記帳");
                entry.setFundPoolId(null); // 主口座扱い
                entry.setFixedCostId(fc.getId());
                // シミュレーションでは固定費として別途加算されるため、学習からは除外する
                entry.setExcludeFromSimulation(true);

                entryRepository.save(entry);
                created++;
            }
        }
        return created;
    }

    /** その月の記帳日。支払日未指定は月初、月末を超える指定（31日など）はその月の末日に丸める。 */
    private LocalDate postingDate(YearMonth ym, Integer paymentDay) {
        int day = (paymentDay == null) ? 1 : Math.min(Math.max(paymentDay, 1), ym.lengthOfMonth());
        return ym.atDay(day);
    }

    /** 記帳先カテゴリを解決する。未指定・他人のカテゴリの場合は「固定費」カテゴリを使う。 */
    private Category resolveCategory(User user, FixedCost fc) {
        if (fc.getCategoryId() != null) {
            Category c = categoryRepository.findById(fc.getCategoryId()).orElse(null);
            if (c != null && c.getUser().getId().equals(user.getId())) {
                return c;
            }
        }
        return categoryRepository.findByUserAndName(user, DEFAULT_CATEGORY)
                .orElseGet(() -> {
                    Category c = new Category();
                    c.setUser(user);
                    c.setName(DEFAULT_CATEGORY);
                    c.setType(EntryType.EXPENSE);
                    return categoryRepository.save(c);
                });
    }
}
