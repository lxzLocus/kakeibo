package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.MealRequestDto;
import com.study.kakeibo.dto.Response.MealResponseDto;
import com.study.kakeibo.service.MealService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/meals")
public class MealController {

    @Autowired
    private MealService mealService;

    @PostMapping
    public ResponseEntity<MealResponseDto> create(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody MealRequestDto dto) {
        return ResponseEntity.ok(mealService.create(userId, dto));
    }

    @GetMapping
    public ResponseEntity<List<MealResponseDto>> getAll(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam String since,
            @RequestParam String until) {
        return ResponseEntity.ok(mealService.getAll(userId, since, until));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MealResponseDto> getById(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        return ResponseEntity.ok(mealService.getById(userId, id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long id) {
        mealService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
