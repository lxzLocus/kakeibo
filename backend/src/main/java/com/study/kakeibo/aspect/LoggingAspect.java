package com.study.kakeibo.aspect;

import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * AOP によるログ出力アスペクト。
 *
 * 対象:
 *   - Controller 層: メソッド呼び出し（リクエスト受信）と実行時間
 *   - Service 層:    メソッド呼び出しと実行時間
 *   - Repository 層: クエリ実行時間
 */
@Aspect
@Component
public class LoggingAspect {

    // --- Pointcut 定義 ---

    /** Controller パッケージ内の全 public メソッド */
    @Pointcut("execution(* com.study.kakeibo.controller..*(..))")
    public void controllerMethods() {}

    /** Service パッケージ内の全 public メソッド */
    @Pointcut("execution(* com.study.kakeibo.service..*(..))")
    public void serviceMethods() {}

    /** Repository パッケージ内の全 public メソッド */
    @Pointcut("execution(* com.study.kakeibo.repository..*(..))")
    public void repositoryMethods() {}

    // --- Controller ログ ---

    /**
     * Controller メソッドの実行を @Around で計測。
     * リクエスト受信 → 処理時間 → レスポンスの流れをログ出力する。
     */
    @Around("controllerMethods()")
    public Object logController(ProceedingJoinPoint joinPoint) throws Throwable {
        Logger log = LoggerFactory.getLogger(joinPoint.getTarget().getClass());
        String methodName = joinPoint.getSignature().getName();
        String args = formatArgs(joinPoint.getArgs());

        log.info("▶ REQUEST  {} | args={}", methodName, args);

        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long elapsed = System.currentTimeMillis() - startTime;
            log.info("◀ RESPONSE {} | {}ms", methodName, elapsed);
            return result;
        } catch (Throwable ex) {
            long elapsed = System.currentTimeMillis() - startTime;
            log.error("✖ ERROR    {} | {}ms | exception={}: {}",
                    methodName, elapsed, ex.getClass().getSimpleName(), ex.getMessage());
            throw ex;
        }
    }

    // --- Service ログ ---

    /**
     * Service メソッドの実行を @Around で計測。
     * ビジネスロジックの処理時間と引数・戻り値をログ出力する。
     */
    @Around("serviceMethods()")
    public Object logService(ProceedingJoinPoint joinPoint) throws Throwable {
        Logger log = LoggerFactory.getLogger(joinPoint.getTarget().getClass());
        String methodName = joinPoint.getSignature().getName();
        String args = formatArgs(joinPoint.getArgs());

        log.debug("→ SERVICE  {} | args={}", methodName, args);

        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long elapsed = System.currentTimeMillis() - startTime;
            log.debug("← SERVICE  {} | {}ms | result={}", methodName, elapsed, summarize(result));
            return result;
        } catch (Throwable ex) {
            long elapsed = System.currentTimeMillis() - startTime;
            log.warn("✖ SERVICE  {} | {}ms | exception={}: {}",
                    methodName, elapsed, ex.getClass().getSimpleName(), ex.getMessage());
            throw ex;
        }
    }

    // --- Repository ログ ---

    /**
     * Repository のクエリ実行時間を @Around で計測。
     */
    @Around("repositoryMethods()")
    public Object logRepository(ProceedingJoinPoint joinPoint) throws Throwable {
        Logger log = LoggerFactory.getLogger(joinPoint.getTarget().getClass());
        String methodName = joinPoint.getSignature().getName();

        long startTime = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long elapsed = System.currentTimeMillis() - startTime;
            log.debug("⇄ QUERY    {} | {}ms", methodName, elapsed);
            return result;
        } catch (Throwable ex) {
            long elapsed = System.currentTimeMillis() - startTime;
            log.error("✖ QUERY    {} | {}ms | exception={}: {}",
                    methodName, elapsed, ex.getClass().getSimpleName(), ex.getMessage());
            throw ex;
        }
    }

    // --- ユーティリティ ---

    /**
     * 引数配列を読みやすい文字列に変換する。
     * パスワード等の機密情報はマスキングする。
     */
    private String formatArgs(Object[] args) {
        if (args == null || args.length == 0) {
            return "[]";
        }
        return Arrays.stream(args)
                .map(arg -> {
                    if (arg == null) return "null";
                    String str = arg.toString();
                    String lower = str.toLowerCase();
                    // パスワード・APIキー等の機密情報をマスキング
                    if (lower.contains("password")
                            || lower.contains("apikey")
                            || lower.contains("api_key")
                            || lower.contains("secret")
                            || lower.contains("bearer ")) {
                        return "[MASKED]";
                    }
                    // APIキーらしき生の値（sk-... : OpenAI/OpenRouter/Anthropic/DeepSeek 等）
                    if (str.startsWith("sk-") || str.startsWith("sk_")) {
                        return "[MASKED]";
                    }
                    // 長すぎる文字列は省略
                    if (str.length() > 200) {
                        return str.substring(0, 200) + "...(truncated)";
                    }
                    return str;
                })
                .toList()
                .toString();
    }

    /**
     * 戻り値を短い要約文字列に変換する。
     */
    private String summarize(Object result) {
        if (result == null) return "null";
        String str = result.toString();
        if (str.length() > 300) {
            return str.substring(0, 300) + "...(truncated)";
        }
        return str;
    }
}
