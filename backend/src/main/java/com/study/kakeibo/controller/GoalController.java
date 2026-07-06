package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.GoalRequestDto;
import com.study.kakeibo.dto.Response.GoalResponseDto;
import com.study.kakeibo.entity.Goal;
import com.study.kakeibo.service.GoalService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/goals")
public class GoalController {

    private final GoalService goalService;

    public GoalController(GoalService goalService) {
        this.goalService = goalService;
    }

    private GoalResponseDto toDto(Goal g) {
        return new GoalResponseDto(g.getId(), g.getTargetName(), g.getTargetAmount(),
                g.getTargetDate(), g.getCurrentSavings());
    }

    /** 目標を取得。未設定なら 204 No Content。 */
    @GetMapping
    public ResponseEntity<GoalResponseDto> get(@RequestHeader("X-User-Id") Long userId) {
        return goalService.getGoal(userId)
                .map(g -> ResponseEntity.ok(toDto(g)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** 目標を登録/更新（1ユーザ1件）。 */
    @PutMapping
    public ResponseEntity<GoalResponseDto> upsert(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody GoalRequestDto request) {
        Goal goal = goalService.upsert(userId, request.getTargetName(), request.getTargetAmount(),
                request.getTargetDate(), request.getCurrentSavings());
        return ResponseEntity.ok(toDto(goal));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestHeader("X-User-Id") Long userId) {
        goalService.delete(userId);
        return ResponseEntity.noContent().build();
    }
}
