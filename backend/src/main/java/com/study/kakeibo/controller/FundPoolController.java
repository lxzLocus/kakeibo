package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.FundPoolRequestDto;
import com.study.kakeibo.dto.Request.TransferRequestDto;
import com.study.kakeibo.dto.Response.FundPoolResponseDto;
import com.study.kakeibo.dto.Response.TransferResponseDto;
import com.study.kakeibo.entity.FundTransfer;
import com.study.kakeibo.service.FundPoolService;
import com.study.kakeibo.service.FundPoolService.PoolBalance;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/pools")
public class FundPoolController {

    private final FundPoolService service;

    public FundPoolController(FundPoolService service) {
        this.service = service;
    }

    private FundPoolResponseDto toDto(PoolBalance pb) {
        return new FundPoolResponseDto(
                pb.pool().getId(), pb.pool().getName(), pb.pool().getInitialBalance(),
                pb.balance(), pb.pool().isPrimary(), pb.pool().getSortOrder(),
                pb.pool().getKind(), pb.pool().getColor());
    }

    private FundPoolResponseDto findDto(Long userId, Long id) {
        return service.listPools(userId).stream()
                .filter(pb -> pb.pool().getId().equals(id))
                .map(this::toDto)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("口座が見つかりません: " + id));
    }

    // --- プール ---

    @GetMapping
    public ResponseEntity<List<FundPoolResponseDto>> list(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(service.listPools(userId).stream().map(this::toDto).toList());
    }

    @PostMapping
    public ResponseEntity<FundPoolResponseDto> create(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody FundPoolRequestDto request) {
        var pool = service.createPool(userId, request.getName(), request.getInitialBalance(), request.getPrimary(),
                request.getKind(), request.getColor());
        return ResponseEntity.status(HttpStatus.CREATED).body(findDto(userId, pool.getId()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<FundPoolResponseDto> update(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id,
            @RequestBody FundPoolRequestDto request) {
        var pool = service.updatePool(userId, id, request.getName(), request.getInitialBalance(), request.getPrimary(),
                request.getKind(), request.getColor());
        return ResponseEntity.ok(findDto(userId, pool.getId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        service.deletePool(userId, id);
        return ResponseEntity.noContent().build();
    }

    // --- 振替 ---

    @GetMapping("/transfers")
    public ResponseEntity<List<TransferResponseDto>> listTransfers(@RequestHeader("X-User-Id") Long userId) {
        Map<Long, String> names = service.listPools(userId).stream()
                .collect(Collectors.toMap(pb -> pb.pool().getId(), pb -> pb.pool().getName()));
        List<TransferResponseDto> dtos = service.listTransfers(userId).stream()
                .map(t -> toTransferDto(t, names))
                .toList();
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/transfers")
    public ResponseEntity<TransferResponseDto> createTransfer(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody TransferRequestDto request) {
        FundTransfer t = service.createTransfer(userId, request.getFromPoolId(), request.getToPoolId(),
                request.getAmount(), request.getTransferDate(), request.getMemo());
        Map<Long, String> names = service.listPools(userId).stream()
                .collect(Collectors.toMap(pb -> pb.pool().getId(), pb -> pb.pool().getName()));
        return ResponseEntity.status(HttpStatus.CREATED).body(toTransferDto(t, names));
    }

    @DeleteMapping("/transfers/{id}")
    public ResponseEntity<Void> deleteTransfer(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        service.deleteTransfer(userId, id);
        return ResponseEntity.noContent().build();
    }

    private TransferResponseDto toTransferDto(FundTransfer t, Map<Long, String> names) {
        return new TransferResponseDto(
                t.getId(),
                t.getFromPoolId(), names.getOrDefault(t.getFromPoolId(), "(削除済み)"),
                t.getToPoolId(), names.getOrDefault(t.getToPoolId(), "(削除済み)"),
                t.getAmount(), t.getTransferDate(), t.getMemo());
    }
}
