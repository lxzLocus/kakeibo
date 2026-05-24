package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.StoreRequestDto;
import com.study.kakeibo.dto.Response.StoreResponseDto;
import com.study.kakeibo.entity.Store;
import com.study.kakeibo.service.StoreService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/stores")
public class StoreController {

    @Autowired
    private StoreService storeService;

    // --- DTO変換ヘルパー ---
    private StoreResponseDto toDto(Store store) {
        return new StoreResponseDto(
                store.getId(),
                store.getUser().getId(),
                store.getName(),
                store.getType(),
                store.getCreatedAt()
        );
    }

    // 店舗追加
    @PostMapping
    public ResponseEntity<StoreResponseDto> createStore(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody StoreRequestDto request
    ) {
        Store newStore = storeService.addStore(userId, request.getName(), request.getType());
        return ResponseEntity.ok(toDto(newStore));
    }

    // ユーザーの店舗一覧取得
    @GetMapping
    public ResponseEntity<List<StoreResponseDto>> getStores(
            @RequestHeader("X-User-Id") Long userId
    ) {
        List<Store> stores = storeService.getStoresByUserId(userId);
        List<StoreResponseDto> response = stores.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    // 店舗更新
    @PutMapping("/{storeId}")
    public ResponseEntity<StoreResponseDto> updateStore(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long storeId,
            @Valid @RequestBody StoreRequestDto request
    ) {
        Store updatedStore = storeService.updateStore(userId, storeId, request.getName(), request.getType());
        return ResponseEntity.ok(toDto(updatedStore));
    }

    // 店舗削除
    @DeleteMapping("/{storeId}")
    public ResponseEntity<Void> deleteStore(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long storeId
    ) {
        storeService.deleteStore(userId, storeId);
        return ResponseEntity.noContent().build();  // 204 No Content
    }
}
