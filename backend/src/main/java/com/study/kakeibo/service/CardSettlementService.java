package com.study.kakeibo.service;

import com.study.kakeibo.entity.FundPool;
import com.study.kakeibo.entity.FundTransfer;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.FundPoolRepository;
import com.study.kakeibo.repository.FundTransferRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * クレジットカードの引き落とし（締め→支払い）を自動化する。
 *
 * カードは kind=CARD の資金プールで、支出を付けると残高がマイナス（未払い）に積み上がる。
 * このサービスは締め日ごとの利用額を集計し、引き落とし日に「引き落とし元口座 → カード」の
 * 振替を自動生成する。振替でカード残高は0に戻り、口座（銀行）から実際に現金が出る。
 *
 * 冪等: fund_transfer.auto_card_id + transfer_date で既存判定し、同じ引き落としを二重に作らない。
 * 引き落とし日は「締め日の“翌”最初の payment_day」= 締め日 < 引き落とし日なら同月、そうでなければ翌月。
 * これにより「翌月払い」も「同月払い」も設定2値（締め日・引き落とし日）だけで表現できる。
 */
@Service
public class CardSettlementService {

    private final FundPoolRepository poolRepository;
    private final FundTransferRepository transferRepository;
    private final EntryRepository entryRepository;

    public CardSettlementService(FundPoolRepository poolRepository,
                                 FundTransferRepository transferRepository,
                                 EntryRepository entryRepository) {
        this.poolRepository = poolRepository;
        this.transferRepository = transferRepository;
        this.entryRepository = entryRepository;
    }

    /**
     * 自動引き落としが有効なカードについて、未処理の引き落としをまとめて生成する（冪等）。
     * @return 生成した振替の件数
     */
    @Transactional
    public int apply(Long userId) {
        LocalDate today = LocalDate.now();
        List<FundPool> pools = poolRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        int created = 0;

        for (FundPool card : pools) {
            if (!"CARD".equals(card.getKind())) continue;
            if (!card.isAutoSettle()) continue;
            if (card.getPaymentDay() == null || card.getSettlementPoolId() == null) continue;
            // 引き落とし元は自分自身以外の実在プールであること
            if (card.getSettlementPoolId().equals(card.getId())) continue;
            boolean srcExists = pools.stream().anyMatch(p -> p.getId().equals(card.getSettlementPoolId()));
            if (!srcExists) continue;

            LocalDate firstUse = entryRepository.minCardExpenseDate(card.getId());
            if (firstUse == null) continue; // 利用が無ければ引き落としも無い

            // 最初の利用を含む締め月から当月まで、締め月ごとに処理
            YearMonth start = YearMonth.from(closingDateOf(YearMonth.from(firstUse), card.getClosingDay())
                    .isBefore(firstUse) ? YearMonth.from(firstUse).plusMonths(1) : YearMonth.from(firstUse));
            YearMonth end = YearMonth.from(today).plusMonths(1); // 当月の締めが今日以前なら対象になり得る

            for (YearMonth m = start; !m.isAfter(end); m = m.plusMonths(1)) {
                LocalDate close = closingDateOf(m, card.getClosingDay());
                LocalDate prevClose = closingDateOf(m.minusMonths(1), card.getClosingDay());
                LocalDate settleDate = settlementDateFor(close, card.getPaymentDay());

                if (settleDate.isAfter(today)) continue; // 引き落とし日がまだ来ていない
                if (transferRepository.existsByAutoCardIdAndTransferDate(card.getId(), settleDate)) continue;

                BigDecimal amount = entryRepository.sumCardExpenseInCycle(card.getId(), prevClose, close);
                if (amount == null || amount.signum() <= 0) continue; // 利用0の月は引き落とし無し

                FundTransfer t = new FundTransfer();
                t.setUserId(userId);
                t.setFromPoolId(card.getSettlementPoolId());
                t.setToPoolId(card.getId());
                t.setAmount(amount);
                t.setTransferDate(settleDate);
                t.setMemo(m.getMonthValue() + "月締め分の引き落とし（" + card.getName() + "）");
                t.setAutoCardId(card.getId());
                transferRepository.save(t);
                created++;
            }
        }
        return created;
    }

    /** その月の締め日（closingDay=null は月末、月の日数を超える指定は末日に丸める）。 */
    private LocalDate closingDateOf(YearMonth m, Integer closingDay) {
        if (closingDay == null) return m.atEndOfMonth();
        int day = Math.min(Math.max(closingDay, 1), m.lengthOfMonth());
        return m.atDay(day);
    }

    /** 締め日 close に対する引き落とし日。close の“翌”最初の paymentDay（同月に無ければ翌月）。 */
    private LocalDate settlementDateFor(LocalDate close, int paymentDay) {
        YearMonth cm = YearMonth.from(close);
        LocalDate cand = cm.atDay(Math.min(Math.max(paymentDay, 1), cm.lengthOfMonth()));
        if (!cand.isAfter(close)) {
            YearMonth nm = cm.plusMonths(1);
            cand = nm.atDay(Math.min(Math.max(paymentDay, 1), nm.lengthOfMonth()));
        }
        return cand;
    }
}
