package com.study.kakeibo.dto.Request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * CSV/Markdownインポートリクエスト DTO
 * フロントエンドでファイルを読み取り、テキスト本文をJSONで送信する。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImportRequestDto {

    @NotBlank(message = "フォーマットは必須です（csv または markdown）")
    private String format;   // "csv" or "markdown"

    @NotBlank(message = "インポートデータは必須です")
    private String content;  // テキスト本文
}
