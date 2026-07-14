package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
public class TransferResponseDto {
    private Long id;
    private Long fromPoolId;
    private String fromPoolName;
    private Long toPoolId;
    private String toPoolName;
    private BigDecimal amount;
    private LocalDate transferDate;
    private String memo;
}
