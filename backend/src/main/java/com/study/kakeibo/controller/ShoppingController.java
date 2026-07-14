package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.ShoppingItemRequestDto;
import com.study.kakeibo.dto.Request.ShoppingItemUpdateDto;
import com.study.kakeibo.dto.Response.ShoppingItemResponseDto;
import com.study.kakeibo.entity.ShoppingItem;
import com.study.kakeibo.service.ShoppingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/shopping")
public class ShoppingController {

    private final ShoppingService shoppingService;

    public ShoppingController(ShoppingService shoppingService) {
        this.shoppingService = shoppingService;
    }

    private ShoppingItemResponseDto toDto(ShoppingItem i) {
        return new ShoppingItemResponseDto(i.getId(), i.getName(), i.getQuantity(),
                i.getEstimatedPrice(), i.isChecked());
    }

    @GetMapping
    public ResponseEntity<List<ShoppingItemResponseDto>> list(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(shoppingService.list(userId).stream().map(this::toDto).toList());
    }

    /** 品名を追加し、LLMで数量・価格を推定して返す。 */
    @PostMapping
    public ResponseEntity<ShoppingItemResponseDto> add(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody ShoppingItemRequestDto request) {
        ShoppingItem item = shoppingService.add(userId, request.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(item));
    }

    /** 部分更新（購入済みチェック・数量・価格・品名）。 */
    @PatchMapping("/{id}")
    public ResponseEntity<ShoppingItemResponseDto> update(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id,
            @RequestBody ShoppingItemUpdateDto request) {
        return ResponseEntity.ok(toDto(shoppingService.update(userId, id, request)));
    }

    /** LLMで数量・価格を再推定する。 */
    @PostMapping("/{id}/reestimate")
    public ResponseEntity<ShoppingItemResponseDto> reestimate(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        return ResponseEntity.ok(toDto(shoppingService.reestimate(userId, id)));
    }

    /** まだ見積りのないアイテムを、1回のLLM呼び出しでまとめて推定する。 */
    @PostMapping("/estimate-pending")
    public ResponseEntity<List<ShoppingItemResponseDto>> estimatePending(
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(shoppingService.estimatePending(userId).stream().map(this::toDto).toList());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        shoppingService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
