package com.study.kakeibo.exception;

import com.study.kakeibo.dto.Response.ErrorResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.HttpRequestMethodNotSupportedException;

import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Map;

/**
 * アプリケーション全体の例外を一元的に処理する。
 * 各Controllerでの try-catch を不要にし、統一されたエラーレスポンスを返す。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // --- ビジネスロジック例外 (400 Bad Request) ---
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponseDto> handleIllegalArgument(
            IllegalArgumentException ex, HttpServletRequest request) {

        log.warn("Business logic error: {} [path={}]", ex.getMessage(), request.getRequestURI());

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Bad Request")
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // --- バリデーション例外 (400 Bad Request) ---
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponseDto> handleValidationException(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fieldError ->
                fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage()));

        log.warn("Validation error: {} [path={}]", fieldErrors, request.getRequestURI());

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Validation Error")
                .message("入力値に誤りがあります")
                .path(request.getRequestURI())
                .validationErrors(fieldErrors)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // --- 必須ヘッダー不足 (400 Bad Request) ---
    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ErrorResponseDto> handleMissingHeader(
            MissingRequestHeaderException ex, HttpServletRequest request) {

        log.warn("Missing required header: {} [path={}]", ex.getHeaderName(), request.getRequestURI());

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Bad Request")
                .message("必須ヘッダーが不足しています: " + ex.getHeaderName())
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // --- 型変換エラー (400 Bad Request) ---
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponseDto> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest request) {

        log.warn("Type mismatch: parameter={}, value={} [path={}]",
                ex.getName(), ex.getValue(), request.getRequestURI());

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Bad Request")
                .message("パラメータの型が正しくありません: " + ex.getName())
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // --- 日付パースエラー (400 Bad Request) ---
    @ExceptionHandler(DateTimeParseException.class)
    public ResponseEntity<ErrorResponseDto> handleDateTimeParseException(
            DateTimeParseException ex, HttpServletRequest request) {

        log.warn("Date parse error: {} [path={}]", ex.getMessage(), request.getRequestURI());

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Bad Request")
                .message("日付の形式が正しくありません。yyyy-MM-dd 形式で指定してください")
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // --- 必須パラメーター不足例外 (400 Bad Request) ---
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponseDto> handleMissingParameter(
            MissingServletRequestParameterException ex, HttpServletRequest request) {

        log.warn("Missing required parameter: {} [path={}]", ex.getParameterName(), request.getRequestURI());

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Bad Request")
                .message("必須パラメーターが不足しています: " + ex.getParameterName())
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    // --- リソースが存在しない例外 (404 Not Found) ---
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponseDto> handleNoResourceFound(
            NoResourceFoundException ex, HttpServletRequest request) {

        log.warn("Resource not found [path={}]", request.getRequestURI());

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.NOT_FOUND.value())
                .error("Not Found")
                .message("リクエストされたリソースが見つかりません")
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    // --- メソッド不許可例外 (405 Method Not Allowed) ---
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponseDto> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {

        log.warn("Method not supported: {} [path={}]", ex.getMethod(), request.getRequestURI());

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.METHOD_NOT_ALLOWED.value())
                .error("Method Not Allowed")
                .message("許可されていないHTTPメソッドです: " + ex.getMethod())
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(error);
    }

    // --- 予期しない例外 (500 Internal Server Error) ---
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponseDto> handleGenericException(
            Exception ex, HttpServletRequest request) {

        log.error("Unexpected error occurred [path={}]", request.getRequestURI(), ex);

        ErrorResponseDto error = ErrorResponseDto.builder()
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .error("Internal Server Error")
                .message("予期しないエラーが発生しました")
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
