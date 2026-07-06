package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class ChatMessageResponseDto {
    private Long id;
    private Long sessionId;
    private String role;
    private String content;
    /** 添付画像のURL（/api/images/xxx）。無ければ null。 */
    private String imageUrl;
    private LocalDateTime createdAt;
}
