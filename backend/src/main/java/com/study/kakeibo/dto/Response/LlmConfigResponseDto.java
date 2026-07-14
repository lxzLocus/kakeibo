package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LlmConfigResponseDto {
    private boolean configured;
    private String baseUrl;
    private String model;
    private boolean hasKey;
    private String maskedKey;
    private boolean supportsVision;
    private boolean directOcr;
}
