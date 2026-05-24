package com.study.kakeibo.dto.Response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 統一エラーレスポンス DTO
 * GlobalExceptionHandler から返却されるエラー情報を格納する。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponseDto {

    /** HTTPステータスコード */
    private int status;

    /** エラー種別（例: "Bad Request", "Not Found"） */
    private String error;

    /** エラーメッセージ */
    private String message;

    /** エラー発生パス */
    private String path;

    /** エラー発生時刻 */
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    /** バリデーションエラーの詳細（フィールド名 → エラーメッセージ） */
    private Map<String, String> validationErrors;
}
