package com.study.kakeibo.dto.Response;

import com.study.kakeibo.entity.EntryType;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EntryResponseDto {
    private Long id;
    private Long userId;
    private String username;
    private LocalDate entryDate;
    private BigDecimal amount;
    private Long categoryId;
    private String categoryName;
    private Long storeId;
    private String storeName;
    private EntryType type;
    private String memo;   // 品名（購入した物・明細）
    private String note;   // 自由記入のメモ
    private Long fundPoolId;
    private boolean excludeFromSimulation; // シミュレーション学習から除外するか
}
