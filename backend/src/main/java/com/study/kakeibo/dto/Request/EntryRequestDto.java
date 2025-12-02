package com.study.kakeibo.dto.Request;


import com.study.kakeibo.entity.EntryType;
import lombok.Data;

import java.time.LocalDate;



@Data
public class EntryRequestDto {
    // userIdはヘッダーから取得するため不要
    private LocalDate entryDate;
    private Double amount;
    private String category;
    private EntryType type;
    private String memo;
}
