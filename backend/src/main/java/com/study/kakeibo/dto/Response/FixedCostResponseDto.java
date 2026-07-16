package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class FixedCostResponseDto {
    private Long id;
    private String name;
    private BigDecimal amount;
    private Integer paymentDay;
    private boolean autoPost;
    private Long categoryId;
}
