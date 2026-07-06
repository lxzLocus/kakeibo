package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class ChatSessionResponseDto {
    private Long id;
    private String title;
    private long messageCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
