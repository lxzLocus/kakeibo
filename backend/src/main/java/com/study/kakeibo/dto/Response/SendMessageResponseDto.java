package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SendMessageResponseDto {
    private ChatMessageResponseDto userMessage;
    private ChatMessageResponseDto aiMessage;
}
