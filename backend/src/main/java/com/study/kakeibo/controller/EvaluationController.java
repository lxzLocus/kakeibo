package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Response.EvaluationResponseDto;
import com.study.kakeibo.entity.UserEvaluation;
import com.study.kakeibo.service.EvaluationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 評価バッチの設定（頻度）と状態（最終実行時刻）を扱う。
 */
@RestController
@RequestMapping("/evaluation")
public class EvaluationController {

    private final EvaluationService evaluationService;

    public EvaluationController(EvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    private EvaluationResponseDto toDto(UserEvaluation e) {
        return new EvaluationResponseDto(
                e.getFrequency(),
                e.getLastRunAt() != null ? e.getLastRunAt().toString() : null,
                evaluationService.summaryOf(e));
    }

    /** 現在の設定・状態を取得。 */
    @GetMapping
    public ResponseEntity<EvaluationResponseDto> get(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(toDto(evaluationService.getOrCreate(userId)));
    }

    /** 実行頻度を更新（OFF / DAILY / WEEKLY / MONTHLY）。 */
    @PutMapping("/frequency")
    public ResponseEntity<EvaluationResponseDto> setFrequency(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam String frequency) {
        return ResponseEntity.ok(toDto(evaluationService.updateFrequency(userId, frequency)));
    }

    /** 今すぐ実行。 */
    @PostMapping("/run")
    public ResponseEntity<EvaluationResponseDto> run(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(toDto(evaluationService.runNow(userId)));
    }
}
