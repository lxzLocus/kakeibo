package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.CategoryRequestDto;
import com.study.kakeibo.dto.Response.CategoryResponseDto;
import com.study.kakeibo.entity.Category;
import com.study.kakeibo.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

    // --- DTO変換ヘルパー ---
    private CategoryResponseDto toDto(Category category) {
        return new CategoryResponseDto(
                category.getId(),
                category.getUser().getId(),
                category.getName(),
                category.getType(),
                category.getGroupName(),
                category.getCreatedAt()
        );
    }

    // カテゴリ追加
    @PostMapping
    public ResponseEntity<CategoryResponseDto> createCategory(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody CategoryRequestDto request
    ) {
        Category newCategory = categoryService.addCategory(
                userId, request.getName(), request.getType(), request.getGroupName());
        return ResponseEntity.ok(toDto(newCategory));
    }

    // ユーザーのカテゴリ一覧取得
    @GetMapping
    public ResponseEntity<List<CategoryResponseDto>> getCategories(
            @RequestHeader("X-User-Id") Long userId
    ) {
        List<Category> categories = categoryService.getCategoriesByUserId(userId);
        List<CategoryResponseDto> response = categories.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    // カテゴリ更新
    @PutMapping("/{categoryId}")
    public ResponseEntity<CategoryResponseDto> updateCategory(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long categoryId,
            @Valid @RequestBody CategoryRequestDto request
    ) {
        Category updatedCategory = categoryService.updateCategory(userId, categoryId, request.getName());
        return ResponseEntity.ok(toDto(updatedCategory));
    }

    // カテゴリのグループ（プライマリ）を設定する。groupName 省略＝未分類に戻す。
    @PutMapping("/{categoryId}/group")
    public ResponseEntity<CategoryResponseDto> setGroup(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long categoryId,
            @RequestParam(required = false) String groupName
    ) {
        Category updated = categoryService.setCategoryGroup(userId, categoryId, groupName);
        return ResponseEntity.ok(toDto(updated));
    }

    // カテゴリ削除（reassignTo 指定時は紐づく取引をそのカテゴリへ付け替えてから削除）
    @DeleteMapping("/{categoryId}")
    public ResponseEntity<Void> deleteCategory(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long categoryId,
            @RequestParam(required = false) Long reassignTo
    ) {
        categoryService.deleteCategory(userId, categoryId, reassignTo);
        return ResponseEntity.noContent().build();  // 204 No Content
    }

    // カテゴリID → 取引件数
    @GetMapping("/usage")
    public ResponseEntity<java.util.Map<Long, Long>> getUsage(
            @RequestHeader("X-User-Id") Long userId
    ) {
        return ResponseEntity.ok(categoryService.getCategoryUsage(userId));
    }

    // カテゴリの並び替え（body = 表示したい順のカテゴリID配列）
    @PutMapping("/order")
    public ResponseEntity<Void> reorder(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody List<Long> orderedIds
    ) {
        categoryService.reorderCategories(userId, orderedIds);
        return ResponseEntity.noContent().build();
    }
}
