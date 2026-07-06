package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.FixedCostRequestDto;
import com.study.kakeibo.dto.Response.FixedCostResponseDto;
import com.study.kakeibo.entity.FixedCost;
import com.study.kakeibo.service.FixedCostService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/fixed-costs")
public class FixedCostController {

    private final FixedCostService fixedCostService;

    public FixedCostController(FixedCostService fixedCostService) {
        this.fixedCostService = fixedCostService;
    }

    private FixedCostResponseDto toDto(FixedCost fc) {
        return new FixedCostResponseDto(fc.getId(), fc.getName(), fc.getAmount(), fc.getPaymentDay());
    }

    @GetMapping
    public ResponseEntity<List<FixedCostResponseDto>> list(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(fixedCostService.list(userId).stream().map(this::toDto).toList());
    }

    @PostMapping
    public ResponseEntity<FixedCostResponseDto> create(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody FixedCostRequestDto request) {
        FixedCost fc = fixedCostService.create(userId, request.getName(), request.getAmount(), request.getPaymentDay());
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(fc));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FixedCostResponseDto> update(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id,
            @RequestBody FixedCostRequestDto request) {
        FixedCost fc = fixedCostService.update(userId, id, request.getName(), request.getAmount(), request.getPaymentDay());
        return ResponseEntity.ok(toDto(fc));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        fixedCostService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
