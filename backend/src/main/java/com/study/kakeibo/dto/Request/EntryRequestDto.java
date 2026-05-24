package com.study.kakeibo.dto.Request;

import com.study.kakeibo.entity.EntryType;
import lombok.Data;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class EntryRequestDto {
    // userIdはヘッダーから取得するため不要
    
    @NotNull(message = "Entry date must not be null")
    private LocalDate entryDate;
    
    @NotNull(message = "Amount must not be null")
    private BigDecimal amount;
    
    @NotNull(message = "Category ID must not be null")
    private Long categoryId;
    
    private Long storeId;     // nullable
    
    @NotNull(message = "Entry type must not be null")
    private EntryType type;
    
    private String memo;
}
