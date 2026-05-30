package com.study.kakeibo.dto.Response;

import com.study.kakeibo.entity.StorageType;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryResponseDto {
    private Long id;
    private String itemName;
    private BigDecimal quantity;
    private String unit;
    private BigDecimal purchasePrice;
    private LocalDate purchaseDate;
    private LocalDate expiryDate;
    private StorageType storage;
    private Boolean isConsumed;
    private Long daysUntilExpiry; // 自動計算用フィールド
    private LocalDateTime createdAt;
}
