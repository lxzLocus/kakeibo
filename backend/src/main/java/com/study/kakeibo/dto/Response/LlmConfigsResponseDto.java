package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * チャット用・画像(OCR)用の2つのLLM設定をまとめて返す。
 */
@Data
@AllArgsConstructor
public class LlmConfigsResponseDto {
    private LlmConfigResponseDto chat;
    private LlmConfigResponseDto vision;
}
