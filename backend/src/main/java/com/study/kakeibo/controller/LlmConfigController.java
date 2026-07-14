package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.LlmConfigRequestDto;
import com.study.kakeibo.dto.Response.LlmConfigResponseDto;
import com.study.kakeibo.dto.Response.LlmConfigsResponseDto;
import com.study.kakeibo.entity.LlmPurpose;
import com.study.kakeibo.service.LlmConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * ユーザごとのLLM APIキー設定（チャット用 / 画像・OCR用の2系統）。
 * 生のAPIキーは絶対にレスポンスへ含めない（マスク表示のみ）。
 */
@RestController
@RequestMapping("/users/me/llm-config")
public class LlmConfigController {

    private final LlmConfigService llmConfigService;

    public LlmConfigController(LlmConfigService llmConfigService) {
        this.llmConfigService = llmConfigService;
    }

    /** チャット用・画像用の両方を返す。 */
    @GetMapping
    public ResponseEntity<LlmConfigsResponseDto> getAll(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(new LlmConfigsResponseDto(
                toDto(userId, LlmPurpose.CHAT),
                toDto(userId, LlmPurpose.VISION)));
    }

    /** 指定用途（chat / vision）を登録・更新。 */
    @PutMapping("/{purpose}")
    public ResponseEntity<LlmConfigResponseDto> upsert(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable String purpose,
            @RequestBody LlmConfigRequestDto request) {
        LlmPurpose p = parse(purpose);
        llmConfigService.upsert(userId, p, request.getBaseUrl(), request.getModel(), request.getApiKey(),
                request.isSupportsVision(), request.isDirectOcr());
        return ResponseEntity.ok(toDto(userId, p));
    }

    /** 指定用途を削除。 */
    @DeleteMapping("/{purpose}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable String purpose) {
        llmConfigService.delete(userId, parse(purpose));
        return ResponseEntity.noContent().build();
    }

    private LlmConfigResponseDto toDto(Long userId, LlmPurpose purpose) {
        return llmConfigService.getMasked(userId, purpose)
                .map(m -> new LlmConfigResponseDto(true, m.baseUrl(), m.model(), m.hasKey(), m.maskedKey(), m.supportsVision(), m.directOcr()))
                .orElseGet(() -> new LlmConfigResponseDto(false, null, null, false, null, false, false));
    }

    private LlmPurpose parse(String purpose) {
        try {
            return LlmPurpose.valueOf(purpose.trim().toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("用途は chat または vision を指定してください。");
        }
    }
}
