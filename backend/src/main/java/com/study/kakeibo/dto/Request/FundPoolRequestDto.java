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
}
