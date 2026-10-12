package com.study.kakeibo.service;

import com.study.kakeibo.dto.Response.EntryResponseDto;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.FundPool;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.FundPoolRepository;
import com.study.kakeibo.repository.FundTransferRepository;
import com.study.kakeibo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** FundPoolService.getPoolEntries（カードの未払い残高の内訳取得）の単体テスト。 */
@ExtendWith(MockitoExtension.class)
class FundPoolServiceTest {

    @Mock private FundPoolRepository poolRepository;
    @Mock private FundTransferRepository transferRepository;
    @Mock private EntryRepository entryRepository;
    @Mock private UserRepository userRepository;
    @Mock private com.study.kakeibo.repository.FixedCostRepository fixedCostRepository;

    @InjectMocks private FundPoolService service;

    private User user;
    private FundPool card;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        card = new FundPool();
        card.setId(10L);
        card.setKind("CARD");
        card.setName("テストカード");
    }

    @Test
    @DisplayName("引き落としが一度も無いカード → カードに紐づく全取引を返す")
    void getPoolEntries_noSettlement() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(poolRepository.findByIdAndUserId(10L, 1L)).thenReturn(Optional.of(card));
        when(transferRepository.maxAutoSettleDate(10L)).thenReturn(null);

        Entry e1 = entry(1L, LocalDate.of(2026, 10, 1), 1000L);
        Entry e2 = entry(2L, LocalDate.of(2026, 9, 15), 2000L);
        when(entryRepository.findByUserAndFundPoolIdOrderByEntryDateDescIdDesc(user, 10L))
                .thenReturn(List.of(e1, e2));

        List<EntryResponseDto> result = service.getPoolEntries(1L, 10L);

        assertThat(result).hasSize(2);
        verify(entryRepository).findByUserAndFundPoolIdOrderByEntryDateDescIdDesc(user, 10L);
    }

    @Test
    @DisplayName("引き落とし済み（最新 settle 日あり）→ 最新 settle 日より後の取引のみ返す")
    void getPoolEntries_withSettlement() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(poolRepository.findByIdAndUserId(10L, 1L)).thenReturn(Optional.of(card));
        LocalDate lastSettle = LocalDate.of(2026, 9, 25);
        when(transferRepository.maxAutoSettleDate(10L)).thenReturn(lastSettle);

        Entry after = entry(3L, LocalDate.of(2026, 10, 2), 3000L);
        when(entryRepository.findByUserAndFundPoolIdAndEntryDateAfterOrderByEntryDateDescIdDesc(
                user, 10L, lastSettle)).thenReturn(List.of(after));

        List<EntryResponseDto> result = service.getPoolEntries(1L, 10L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(3L);
        verify(entryRepository).findByUserAndFundPoolIdAndEntryDateAfterOrderByEntryDateDescIdDesc(
                eq(user), eq(10L), eq(lastSettle));
    }

    @Test
    @DisplayName("カードが無い（他ユーザー等）→ 例外")
    void getPoolEntries_notOwned() {
        when(poolRepository.findByIdAndUserId(10L, 999L)).thenReturn(Optional.empty());
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                () -> service.getPoolEntries(999L, 10L));
    }

    private Entry entry(Long id, LocalDate date, long amount) {
        Entry e = new Entry();
        e.setId(id);
        e.setUser(user);
        e.setEntryDate(date);
        e.setAmount(new java.math.BigDecimal(amount));
        e.setType(EntryType.EXPENSE);
        return e;
    }
}
