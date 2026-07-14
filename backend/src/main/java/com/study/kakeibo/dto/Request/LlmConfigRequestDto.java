package com.study.kakeibo.dto.Request;

import lombok.Data;
import lombok.ToString;

@Data
public class LlmConfigRequestDto {
    private String baseUrl;
    private String model;
    /** 生のAPIキー。更新時に空なら既存キーを維持する。ログに出さないよう toString から除外。 */
    @ToString.Exclude
    private String apiKey;
    /** このモデルが画像入力に対応するか（チャットの画像送信可否）。 */
    private boolean supportsVision;

    /** レシート読取モード: true=画像を直接LLMへ / false=Tesseract OCR→テキストLLM */
    private boolean directOcr;
}
