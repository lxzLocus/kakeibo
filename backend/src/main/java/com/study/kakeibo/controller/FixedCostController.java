package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.FixedCostRequestDto;
import com.study.kakeibo.dto.Response.FixedCostResponseDto;
import com.study.kakeibo.entity.FixedCost;
import com.study.kakeibo.service.FixedCostPostingService;
import com.study.kakeibo.service.FixedCostService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/fixed-costs")
public class FixedCostController {

    private final FixedCostService fixedCostService;
    private final FixedCostPostingService postingService;

    public FixedCostController(FixedCostService fixedCostService, FixedCostPostingService postingService) {
        this.fixedCostService = fixedCostService;
        this.postingService = postingService;
    }

    private FixedCostResponseDto toDto(FixedCost fc) {
        return new FixedCostResponseDto(fc.getId(), fc.getName(), fc.getAmount(), fc.getPaymentDay(),
                fc.isAutoPost(), fc.getCategoryId(), fc.getPaymentPoolId());
    }

    @GetMapping
    public ResponseEntity<List<FixedCostResponseDto>> list(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(fixedCostService.list(userId).stream().map(this::toDto).toList());
    }

    @PostMapping
    public ResponseEntity<FixedCostResponseDto> create(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody FixedCostRequestDto request) {
        FixedCost fc = fixedCostService.create(userId, request.getName(), request.getAmount(),
                request.getPaymentDay(), request.isAutoPost(), request.getCategoryId(), request.getPaymentPoolId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(fc));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FixedCostResponseDto> update(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id,
            @RequestBody FixedCostRequestDto request) {
        FixedCost fc = fixedCostService.update(userId, id, request.getName(), request.getAmount(),
                request.getPaymentDay(), request.isAutoPost(), request.getCategoryId(), request.getPaymentPoolId());
        return ResponseEntity.ok(toDto(fc));
    }

    /**
     * 自動記帳が有効な固定費のうち、未記帳の月ぶんを収支へ反映する（冪等）。
     * アプリを開いたときや、設定画面の「今すぐ反映」から呼ぶ。
     *
     * POST /fixed-costs/apply → { "created": 2 }
     */
    @PostMapping("/apply")
    public ResponseEntity<Map<String, Integer>> apply(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(Map.of("created", postingService.apply(userId)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        fixedCostService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
