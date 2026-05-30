package com.study.kakeibo.dto.Request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MealRequestDto {
    @NotNull(message = "食事日時は必須です")
    private String mealDatetime; // yyyy-MM-dd'T'HH:mm:ss

    @NotBlank(message = "食事タイプは必須です")
    private String mealType; // BREAKFAST, LUNCH, DINNER, SNACK

    @NotBlank(message = "タイトルは必須です")
    private String title;

    @NotNull(message = "人数は必須です")
    @Min(value = 1, message = "人数は1以上である必要があります")
    private Integer servings = 1;

    private String note;

    @Valid
    private List<MealItemRequestDto> items;
}
