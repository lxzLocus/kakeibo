package com.study.kakeibo.dto.Response;

import com.study.kakeibo.entity.EntryType;
import lombok.Data;

import java.time.LocalDate;

@Data
public class EntryResponseDto {
    private Long userId;
    private LocalDate entryDate;
    private Double amount;
    private String category;
    private EntryType type;
    private String memo;
    private String username;
}
