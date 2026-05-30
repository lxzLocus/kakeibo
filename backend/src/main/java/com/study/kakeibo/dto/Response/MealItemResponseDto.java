package com.study.kakeibo.dto.Response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MealItemResponseDto {
    private Long id;
    private Long inventoryId;
    private String itemName;
    private BigDecimal quantityUsed;
    private BigDecimal estimatedCost;
}
