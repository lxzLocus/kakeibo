package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class FundPoolResponseDto {
    private Long id;
    private String name;
    /** 開始残高（手動入力の起点）。 */
    private BigDecimal initialBalance;
    /** 現在残高（開始残高 + 収支 + 振替で計算）。カードは未払い額が負で出る。 */
    private BigDecimal balance;
    private boolean primary;
    private Integer sortOrder;
    /** 種別: BANK / CASH / CARD。 */
    private String kind;
    /** 表示色（カードのブランドカラー等）。 */
    private String color;
}
