package com.study.kakeibo.dto.Request;

import lombok.Data;

import java.math.BigDecimal;

/** 資金プールの作成/更新（各フィールドは更新時 null で変更しない）。 */
@Data
public class FundPoolRequestDto {
    private String name;
    private BigDecimal initialBalance;
    private Boolean primary;
    /** 種別: BANK / CASH / CARD（null は変更しない/新規は BANK）。 */
    private String kind;
    /** 表示色（カードのブランドカラー等）。 */
    private String color;

    // --- カードの引き落とし設定 ---
    /** 締め日 (1-31, null は月末)。 */
    private Integer closingDay;
    /** 引き落とし日 (1-31)。 */
    private Integer paymentDay;
    /** 引き落とし元の口座（銀行プール）ID。 */
    private Long settlementPoolId;
    /** 自動引き落としを有効にするか。 */
    private Boolean autoSettle;
}
