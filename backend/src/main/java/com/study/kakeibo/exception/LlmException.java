package com.study.kakeibo.exception;

/**
 * LLM API呼び出しに関するエラー（接続失敗・4xx/5xx・非JSON応答など）。
 * ユーザーに原因が分かるメッセージを持たせ、GlobalExceptionHandler で 502 として返す。
 */
public class LlmException extends RuntimeException {
    public LlmException(String message) {
        super(message);
    }

    public LlmException(String message, Throwable cause) {
        super(message, cause);
    }
}
