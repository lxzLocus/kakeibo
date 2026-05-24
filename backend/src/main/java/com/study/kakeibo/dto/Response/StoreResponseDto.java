package com.study.kakeibo.dto.Response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StoreResponseDto {
    private Long storeId;
    private Long userId;
    private String name;
    private String type;
    private LocalDateTime createdAt;
}
