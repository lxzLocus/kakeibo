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

    /** 品名（購入した物・明細）。 */
    private String memo;

    /** 自由記入のメモ。 */
    private String note;

    /** 収支を紐づける資金プール（口座）ID。null は主口座扱い。 */
    private Long fundPoolId;
}
