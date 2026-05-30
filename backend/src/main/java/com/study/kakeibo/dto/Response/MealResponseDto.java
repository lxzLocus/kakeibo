package com.study.kakeibo.dto.Response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MealResponseDto {
    private Long id;
    private LocalDateTime mealDatetime;
    private String mealType;
    private String title;
    private Integer servings;
    private String note;
    private BigDecimal estimatedTotalCost;
    private BigDecimal costPerServing;
    private List<MealItemResponseDto> items;
}
