package com.study.kakeibo.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** FundPoolService の未払い期間計算（unpaidSince）の単体テスト。 */
class FundPoolServiceTest {

    @Test
    @DisplayName("締め日25日・今日12日 → 前月26日から（今月の締め日が未到来）")
    void unpaidSince_beforeClosingDay() {
        LocalDate today = LocalDate.of(2026, 10, 12);
        LocalDate since = FundPoolService.unpaidSince(today, 25);
        assertThat(since).isEqualTo(LocalDate.of(2026, 9, 26));
    }

    @Test
    @DisplayName("締め日25日・今日30日 → 当月26日から（今月の締め日は済み）")
    void unpaidSince_afterClosingDay() {
        LocalDate today = LocalDate.of(2026, 10, 30);
        LocalDate since = FundPoolService.unpaidSince(today, 25);
        assertThat(since).isEqualTo(LocalDate.of(2026, 10, 26));
    }

    @Test
    @DisplayName("締め日25日・今日がちょうど締め日 → 締め日翌日（当月26日）から（当月分は締め日まで）")
    void unpaidSince_onClosingDay() {
        LocalDate today = LocalDate.of(2026, 10, 25);
        LocalDate since = FundPoolService.unpaidSince(today, 25);
        assertThat(since).isEqualTo(LocalDate.of(2026, 10, 26));
    }

    @Test
    @DisplayName("締め日未設定（月末）→ 当月1日から")
    void unpaidSince_noClosingDay() {
        LocalDate today = LocalDate.of(2026, 10, 12);
        LocalDate since = FundPoolService.unpaidSince(today, null);
        assertThat(since).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    @DisplayName("31日締め・短い月（2月）は月末に丸め、前月の締め日を起点にする")
    void unpaidSince_closingDay31_inShortMonth() {
        LocalDate today = LocalDate.of(2026, 2, 20);
        LocalDate since = FundPoolService.unpaidSince(today, 31);
        // 2月の31日は存在しない → 2月末(28日) を今月の締め日とみなし、前月1月31日が起点
        assertThat(since).isEqualTo(LocalDate.of(2026, 2, 1));
    }

    @Test
    @DisplayName("31日締め・12月31日はちょうど基準日")
    void unpaidSince_yearEnd() {
        // 12/31 は締め日当日 → 翌年1/1 からが未払い
        LocalDate today = LocalDate.of(2026, 12, 31);
        LocalDate since = FundPoolService.unpaidSince(today, 31);
        assertThat(since).isEqualTo(LocalDate.of(2027, 1, 1));
    }
}
