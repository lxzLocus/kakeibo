package com.study.kakeibo.service;

import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.FundPool;
import com.study.kakeibo.entity.FundTransfer;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.FundPoolRepository;
import com.study.kakeibo.repository.FundTransferRepository;
import com.study.kakeibo.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 資金プール（口座）と振替。現在残高は保存せず、開始残高＋そのプールの収支＋振替から計算する。
 * 総資産 = 全プール残高の合計。振替は net-zero（総資産は変化しない）。
 */
@Service
public class FundPoolService {

    private final FundPoolRepository poolRepository;
    private final FundTransferRepository transferRepository;
    private final EntryRepository entryRepository;
    private final UserRepository userRepository;

    public FundPoolService(FundPoolRepository poolRepository,
                           FundTransferRepository transferRepository,
                           EntryRepository entryRepository,
                           UserRepository userRepository) {
        this.poolRepository = poolRepository;
        this.transferRepository = transferRepository;
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
    }

    /** プール＋計算済み残高。 */
    public record PoolBalance(FundPool pool, BigDecimal balance) {
    }

    /** 自動作成される主口座の既定名。 */
    private static final String DEFAULT_POOL_NAME = "メイン口座";

    /**
     * プールが1つも無ければ主口座「メイン口座」を自動作成する。
     * あわせて、過去の競合で生じた重複を自己修復する（重複した空のメイン口座を1つに集約し、
     * 主口座フラグをちょうど1つにする）。
     *
     * 二重作成の再発防止のため、ユーザー行を排他ロックして同一ユーザーの処理を直列化する。
     */
    @Transactional
    public void ensureDefaultPool(Long userId) {
        // 並行リクエストが同時に「プール無し」を見て主口座を二重作成する競合を、
        // ユーザー行のロックで直列化して防ぐ。
        userRepository.lockById(userId);

        List<FundPool> pools = poolRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        if (pools.isEmpty()) {
            FundPool p = new FundPool();
            p.setUserId(userId);
            p.setName(DEFAULT_POOL_NAME);
            p.setInitialBalance(BigDecimal.ZERO);
            p.setPrimary(true);
            p.setSortOrder(0);
            poolRepository.save(p);
            return;
        }
        healDuplicates(userId, pools);
    }

    /**
     * 競合で生じた重複を修復する。
     *  1) 自動作成された空の「メイン口座」が複数あれば、最古の1つだけ残して他は削除
     *     （削除する口座の収支は主口座へ戻し、関連する振替は削除する）。
     *  2) 主口座（primary）がちょうど1つになるよう正規化する。
     */
    private void healDuplicates(Long userId, List<FundPool> pools) {
        // 1) 重複した「空のメイン口座」を集約
        List<FundPool> emptyDefaults = pools.stream()
                .filter(p -> DEFAULT_POOL_NAME.equals(p.getName())
                        && (p.getInitialBalance() == null || p.getInitialBalance().signum() == 0))
                .sorted(java.util.Comparator.comparing(FundPool::getId))
                .collect(Collectors.toList());
        if (emptyDefaults.size() > 1 && pools.size() > 1) {
            // 最古（先頭）を残し、残りを削除。ただし全消しは避ける。
            for (int i = 1; i < emptyDefaults.size() && pools.size() > 1; i++) {
                FundPool dup = emptyDefaults.get(i);
                entryRepository.clearFundPool(dup.getId());                        // 収支は主口座へ
                transferRepository.deleteByFromPoolIdOrToPoolId(dup.getId(), dup.getId());
                poolRepository.delete(dup);
                pools.remove(dup);
            }
            pools = poolRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        }

        // 2) 主口座をちょうど1つに
        List<FundPool> primaries = pools.stream().filter(FundPool::isPrimary).collect(Collectors.toList());
        if (primaries.size() != 1) {
            Long keepId = (primaries.isEmpty() ? pools.get(0) : primaries.get(0)).getId();
            for (FundPool p : pools) {
                boolean shouldBePrimary = p.getId().equals(keepId);
                if (p.isPrimary() != shouldBePrimary) {
                    p.setPrimary(shouldBePrimary);
                    poolRepository.save(p);
                }
            }
        }
    }

    /** 全プールを計算済み残高付きで返す。 */
    @Transactional
    public List<PoolBalance> listPools(Long userId) {
        ensureDefaultPool(userId);
        List<FundPool> pools = poolRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("ユーザーが見つかりません: " + userId));

        Long primaryId = pools.stream().filter(FundPool::isPrimary).findFirst()
                .map(FundPool::getId).orElse(pools.get(0).getId());
        Set<Long> poolIds = pools.stream().map(FundPool::getId).collect(Collectors.toSet());

        Map<Long, BigDecimal> balance = new HashMap<>();
        for (FundPool p : pools) {
            balance.put(p.getId(), p.getInitialBalance() == null ? BigDecimal.ZERO : p.getInitialBalance());
        }

        // 収支（fundPoolId が無い/削除済みなら主口座に集計）
        for (Object[] row : entryRepository.sumByPoolAndType(user)) {
            Long poolId = (Long) row[0];
            EntryType type = (EntryType) row[1];
            BigDecimal sum = (BigDecimal) row[2];
            if (sum == null) continue;
            Long eff = (poolId != null && poolIds.contains(poolId)) ? poolId : primaryId;
            BigDecimal cur = balance.getOrDefault(eff, BigDecimal.ZERO);
            balance.put(eff, type == EntryType.INCOME ? cur.add(sum) : cur.subtract(sum));
        }

        // 振替（net-zero）
        for (FundTransfer t : transferRepository.findByUserId(userId)) {
            if (balance.containsKey(t.getFromPoolId())) {
                balance.put(t.getFromPoolId(), balance.get(t.getFromPoolId()).subtract(t.getAmount()));
            }
            if (balance.containsKey(t.getToPoolId())) {
                balance.put(t.getToPoolId(), balance.get(t.getToPoolId()).add(t.getAmount()));
            }
        }

        List<PoolBalance> result = new ArrayList<>();
        for (FundPool p : pools) {
            result.add(new PoolBalance(p, balance.getOrDefault(p.getId(), BigDecimal.ZERO)));
        }
        return result;
    }

    /** 許可される種別。未知値は BANK に丸める。 */
    private String normalizeKind(String kind) {
        if (kind == null) return "BANK";
        String k = kind.trim().toUpperCase();
        return (k.equals("BANK") || k.equals("CASH") || k.equals("CARD")) ? k : "BANK";
    }

    @Transactional
    public FundPool createPool(Long userId, String name, BigDecimal initialBalance, Boolean primary,
                               String kind, String color) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("口座名を入力してください。");
        }
        long count = poolRepository.countByUserId(userId);
        boolean makePrimary = Boolean.TRUE.equals(primary) || count == 0;
        if (makePrimary) {
            unsetPrimary(userId);
        }
        FundPool p = new FundPool();
        p.setUserId(userId);
        p.setName(name.trim());
        p.setInitialBalance(initialBalance == null ? BigDecimal.ZERO : initialBalance);
        p.setPrimary(makePrimary);
        p.setSortOrder((int) count);
        p.setKind(normalizeKind(kind));
        p.setColor(color != null && !color.isBlank() ? color.trim() : null);
        return poolRepository.save(p);
    }

    @Transactional
    public FundPool updatePool(Long userId, Long id, String name, BigDecimal initialBalance, Boolean primary,
                               String kind, String color) {
        FundPool p = getOwnedPool(userId, id);
        if (name != null && !name.isBlank()) {
            p.setName(name.trim());
        }
        if (initialBalance != null) {
            p.setInitialBalance(initialBalance);
        }
        if (Boolean.TRUE.equals(primary) && !p.isPrimary()) {
            unsetPrimary(userId);
            p.setPrimary(true);
        }
        if (kind != null) {
            p.setKind(normalizeKind(kind));
        }
        if (color != null) {
            p.setColor(color.isBlank() ? null : color.trim());
        }
        return poolRepository.save(p);
    }

    @Transactional
    public void deletePool(Long userId, Long id) {
        FundPool p = getOwnedPool(userId, id);
        if (poolRepository.countByUserId(userId) <= 1) {
            throw new IllegalArgumentException("最後の口座は削除できません。");
        }
        // このプールの収支は主口座(null)へ戻し、関連する振替は削除する
        entryRepository.clearFundPool(id);
        transferRepository.deleteByFromPoolIdOrToPoolId(id, id);
        boolean wasPrimary = p.isPrimary();
        poolRepository.delete(p);
        if (wasPrimary) {
            List<FundPool> rest = poolRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
            if (!rest.isEmpty()) {
                FundPool next = rest.get(0);
                next.setPrimary(true);
                poolRepository.save(next);
            }
        }
    }

    // --- 振替 ---

    @Transactional(readOnly = true)
    public List<FundTransfer> listTransfers(Long userId) {
        return transferRepository.findByUserIdOrderByTransferDateDescIdDesc(userId);
    }

    @Transactional
    public FundTransfer createTransfer(Long userId, Long fromPoolId, Long toPoolId,
                                       BigDecimal amount, LocalDate date, String memo) {
        if (fromPoolId.equals(toPoolId)) {
            throw new IllegalArgumentException("振替元と振替先には別の口座を選んでください。");
        }
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("金額は1以上を入力してください。");
        }
        getOwnedPool(userId, fromPoolId); // 所有確認
        getOwnedPool(userId, toPoolId);

        FundTransfer t = new FundTransfer();
        t.setUserId(userId);
        t.setFromPoolId(fromPoolId);
        t.setToPoolId(toPoolId);
        t.setAmount(amount);
        t.setTransferDate(date);
        t.setMemo(memo != null && !memo.isBlank() ? memo.trim() : null);
        return transferRepository.save(t);
    }

    @Transactional
    public void deleteTransfer(Long userId, Long id) {
        FundTransfer t = transferRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("振替が見つかりません: " + id));
        transferRepository.delete(t);
    }

    private FundPool getOwnedPool(Long userId, Long id) {
        return poolRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("口座が見つかりません: " + id));
    }

    private void unsetPrimary(Long userId) {
        for (FundPool p : poolRepository.findByUserIdOrderBySortOrderAscIdAsc(userId)) {
            if (p.isPrimary()) {
                p.setPrimary(false);
                poolRepository.save(p);
            }
        }
    }
}
