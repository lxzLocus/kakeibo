package com.study.kakeibo.dto.Request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class FixedCostRequestDto {
    private String name;
    private BigDecimal amount;
    /** 毎月の支払日（1-31）。未指定なら月初に記帳する。 */
    private Integer paymentDay;
    /** 毎月この固定費を収支へ自動記帳するか。 */
    private boolean autoPost;
    /** 自動記帳先のカテゴリID。未指定なら「固定費」カテゴリを使う。 */
    private Long categoryId;
    /** 支払い元プール（口座/カード）ID。未指定は主口座。カードを指定するとカード払い。 */
    private Long paymentPoolId;
}
