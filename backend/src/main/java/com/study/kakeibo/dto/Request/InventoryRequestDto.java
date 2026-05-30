package com.study.kakeibo.dto.Request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryRequestDto {

    @NotBlank(message = "食材名は必須です")
    private String itemName;

    @NotNull(message = "数量は必須です")
    @Positive(message = "数量は0より大きい必要があります")
    private BigDecimal quantity;

    private String unit;           // デフォルト: "個"

    private BigDecimal purchasePrice;   // 購入時価格（任意）

    private String purchaseDate;   // yyyy-MM-dd（任意）

    private String expiryDate;     // yyyy-MM-dd（任意）

    private String storage;        // REFRIGERATED, FROZEN, ROOM_TEMP
}
