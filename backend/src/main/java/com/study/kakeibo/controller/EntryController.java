package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.*;
import com.study.kakeibo.dto.Response.*;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.service.EntryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.time.LocalDate;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/entries")
public class EntryController {
    
    @Autowired
    private EntryService entryService;

    // 登録
    @PostMapping
    public ResponseEntity<EntryResponseDto> createEntry(
            @RequestHeader("X-User-Id") Long userId,  // ヘッダーからユーザーIDを取得
            @RequestBody EntryRequestDto request
    ) {
        try {
            Entry newEntry = entryService.addEntry(
                    userId,
                    request.getEntryDate(),
                    request.getAmount(),
                    request.getCategory(),
                    request.getType(),
                    request.getMemo()
            );

            EntryResponseDto response = new EntryResponseDto();
            response.setUserId(userId);
            response.setEntryDate(newEntry.getEntryDate());
            response.setAmount(newEntry.getAmount());
            response.setCategory(newEntry.getCategory());
            response.setType(newEntry.getType());
            response.setMemo(newEntry.getMemo());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // 取得
    @GetMapping
    public ResponseEntity<List<EntryResponseDto>> getEntries(
            @RequestHeader("X-User-Id") Long userId,  // ヘッダーからユーザーIDを取得
            @RequestParam(required = false) String since,
            @RequestParam(required = false) String until
    ) {
        try {
            List<Entry> entries = entryService.getEntryByUserId(userId);

            System.out.println(userId);

            // 期間でフィルタリング
            if(since != null && until != null) {
                LocalDate sinceDate = LocalDate.parse(since);
                LocalDate untilDate = LocalDate.parse(until);
                entries = entries.stream()
                        .filter(entry -> !entry.getEntryDate().isBefore(sinceDate) && !entry.getEntryDate().isAfter(untilDate))
                        .collect(Collectors.toList());
            } else if(since != null) {
                LocalDate sinceDate = LocalDate.parse(since);
                entries = entries.stream()
                        .filter(entry -> !entry.getEntryDate().isBefore(sinceDate))
                        .collect(Collectors.toList());
            } else if(until != null) {
                LocalDate untilDate = LocalDate.parse(until);
                entries = entries.stream()
                        .filter(entry -> !entry.getEntryDate().isAfter(untilDate))
                        .collect(Collectors.toList());
            }

            // フィルタリング後のentriesをDTOに変換（ここで初期化）
            List<EntryResponseDto> response = entries.stream()
                    .map(entry -> {
                        EntryResponseDto dto = new EntryResponseDto();
                        dto.setUsername(entry.getUser().getUsername());
                        dto.setEntryDate(entry.getEntryDate());
                        dto.setAmount(entry.getAmount());
                        dto.setCategory(entry.getCategory());
                        dto.setType(entry.getType());
                        dto.setMemo(entry.getMemo());
                        return dto;
                    })
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // 更新
    @PutMapping("/{entryId}")
    public ResponseEntity<EntryResponseDto> updateEntry(
            @PathVariable Long entryId,
            @RequestBody EntryRequestDto request
    ) {
        try {
            Entry updatedEntry = entryService.updateEntry(
                    entryId,
                    request.getEntryDate(),
                    request.getAmount(),
                    request.getCategory(),
                    request.getType(),
                    request.getMemo()
            );

            EntryResponseDto response = new EntryResponseDto();
            response.setUserId(updatedEntry.getUser().getId());
            response.setUsername(updatedEntry.getUser().getUsername());
            response.setEntryDate(updatedEntry.getEntryDate());
            response.setAmount(updatedEntry.getAmount());
            response.setCategory(updatedEntry.getCategory());
            response.setType(updatedEntry.getType());
            response.setMemo(updatedEntry.getMemo());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // 削除
    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> deleteEntry(@PathVariable Long entryId) {
        try {
            entryService.deleteEntry(entryId);
            return ResponseEntity.noContent().build();  // 204 No Content
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();  // 404 Not Found
        }
    }
}
