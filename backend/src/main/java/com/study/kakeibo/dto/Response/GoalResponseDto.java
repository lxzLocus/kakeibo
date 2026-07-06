package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
public class GoalResponseDto {
    private Long id;
    private String targetName;
    private BigDecimal targetAmount;
    private LocalDate targetDate;
    private BigDecimal currentSavings;
}
