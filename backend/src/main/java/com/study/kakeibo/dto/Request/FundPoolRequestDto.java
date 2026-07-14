package com.study.kakeibo.dto.Request;

import lombok.Data;

import java.math.BigDecimal;

/** 資金プールの作成/更新（各フィールドは更新時 null で変更しない）。 */
@Data
public class FundPoolRequestDto {
    private String name;
    private BigDecimal initialBalance;
    private Boolean primary;
}
