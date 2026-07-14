package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class SendMessageResponseDto {
    private ChatMessageResponseDto userMessage;
    private ChatMessageResponseDto aiMessage;
    /** 最初の数ターンのみ生成される関連質問（画面下部に表示）。無ければ空。 */
    private List<String> relatedQuestions;
}
