package com.study.kakeibo.dto.Request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class FixedCostRequestDto {
    private String name;
    private BigDecimal amount;
    private Integer paymentDay;
}
