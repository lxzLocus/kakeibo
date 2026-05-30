package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.InventoryRequestDto;
import com.study.kakeibo.dto.Response.InventoryResponseDto;
import com.study.kakeibo.service.InventoryService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/inventory")
public class InventoryController {

    @Autowired
    private InventoryService inventoryService;

    @PostMapping
    public ResponseEntity<InventoryResponseDto> create(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody InventoryRequestDto dto) {
        return ResponseEntity.ok(inventoryService.create(userId, dto));
    }

    @GetMapping
    public ResponseEntity<List<InventoryResponseDto>> getAll(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) String storage) {
        return ResponseEntity.ok(inventoryService.getAll(userId, storage));
    }

    @GetMapping("/expiring")
    public ResponseEntity<List<InventoryResponseDto>> getExpiringSoon(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(defaultValue = "3") int days) {
        return ResponseEntity.ok(inventoryService.getExpiringSoon(userId, days));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InventoryResponseDto> update(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id,
            @Valid @RequestBody InventoryRequestDto dto) {
        return ResponseEntity.ok(inventoryService.update(userId, id, dto));
    }

    @PutMapping("/{id}/consume")
    public ResponseEntity<InventoryResponseDto> consume(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        return ResponseEntity.ok(inventoryService.consume(userId, id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        inventoryService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
