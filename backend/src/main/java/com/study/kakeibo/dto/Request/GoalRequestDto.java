package com.study.kakeibo.dto.Request;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonFormat;

@Data
public class GoalRequestDto {
    private String targetName;
    private BigDecimal targetAmount;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate targetDate;

    private BigDecimal currentSavings;
}
