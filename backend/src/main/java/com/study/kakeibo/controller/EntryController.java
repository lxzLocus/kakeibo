package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.EntryRequestDto;
import com.study.kakeibo.dto.Response.EntryResponseDto;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.service.EntryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;
import java.time.LocalDate;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/entries")
public class EntryController {
    
    @Autowired
    private EntryService entryService;

    // --- DTO変換ヘルパー ---
    private EntryResponseDto toDto(Entry entry) {
        EntryResponseDto dto = new EntryResponseDto();
        dto.setId(entry.getId());
        dto.setUserId(entry.getUser().getId());
        dto.setUsername(entry.getUser().getUsername());
        dto.setEntryDate(entry.getEntryDate());
        dto.setAmount(entry.getAmount());
        dto.setCategoryId(entry.getCategory().getId());
        dto.setCategoryName(entry.getCategory().getName());
        if (entry.getStore() != null) {
            dto.setStoreId(entry.getStore().getId());
            dto.setStoreName(entry.getStore().getName());
        }
        dto.setType(entry.getType());
        dto.setMemo(entry.getMemo());
        return dto;
    }

    // 登録
    @PostMapping
    public ResponseEntity<EntryResponseDto> createEntry(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody EntryRequestDto request
    ) {
        Entry newEntry = entryService.addEntry(
                userId,
                request.getEntryDate(),
                request.getAmount(),
                request.getCategoryId(),
                request.getStoreId(),
                request.getType(),
                request.getMemo()
        );
        return ResponseEntity.ok(toDto(newEntry));
    }

    // 取得
    @GetMapping
    public ResponseEntity<List<EntryResponseDto>> getEntries(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) String since,
            @RequestParam(required = false) String until
    ) {
        List<Entry> entries;

        // 期間指定がある場合はRepositoryのクエリを使用
        if (since != null && until != null) {
            LocalDate sinceDate = LocalDate.parse(since);
            LocalDate untilDate = LocalDate.parse(until);
            entries = entryService.getEntryByUserAndDateRange(userId, sinceDate, untilDate);
        } else if (since != null) {
            LocalDate sinceDate = LocalDate.parse(since);
            entries = entryService.getEntryByUserAndDateRange(userId, sinceDate, LocalDate.of(9999, 12, 31));
        } else if (until != null) {
            LocalDate untilDate = LocalDate.parse(until);
            entries = entryService.getEntryByUserAndDateRange(userId, LocalDate.of(1970, 1, 1), untilDate);
        } else {
            entries = entryService.getEntryByUserId(userId);
        }

        List<EntryResponseDto> response = entries.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(response);
    }

    // 更新
    @PutMapping("/{entryId}")
    public ResponseEntity<EntryResponseDto> updateEntry(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long entryId,
            @Valid @RequestBody EntryRequestDto request
    ) {
        Entry updatedEntry = entryService.updateEntry(
                userId,
                entryId,
                request.getEntryDate(),
                request.getAmount(),
                request.getCategoryId(),
                request.getStoreId(),
                request.getType(),
                request.getMemo()
        );
        return ResponseEntity.ok(toDto(updatedEntry));
    }

    // 削除
    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> deleteEntry(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long entryId
    ) {
        entryService.deleteEntry(userId, entryId);
        return ResponseEntity.noContent().build();  // 204 No Content
    }
}
