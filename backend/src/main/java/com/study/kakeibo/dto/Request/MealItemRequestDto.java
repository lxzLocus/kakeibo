package com.study.kakeibo.dto.Request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MealItemRequestDto {
    @NotNull(message = "食材IDは必須です")
    private Long inventoryId;

    @NotNull(message = "使用量は必須です")
    @Positive(message = "使用量は0より大きい必要があります")
    private BigDecimal quantityUsed;
}
