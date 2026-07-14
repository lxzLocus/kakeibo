package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Response.SimulationResultDto;
import com.study.kakeibo.service.SimulationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/simulation")
public class SimulationController {

    private final SimulationService simulationService;

    public SimulationController(SimulationService simulationService) {
        this.simulationService = simulationService;
    }

    /**
     * 目標・固定費・収支実績からモンテカルロ・シミュレーションを実行する。
     * FEから調整可能な what-if 変数（年齢・保険カバー率・月収・変動費・現在貯蓄額）を任意で受け取る。
     * 省略した変数は既定（学習値/デフォルト）で計算する。
     */
    @GetMapping
    public ResponseEntity<SimulationResultDto> run(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) Integer age,
            @RequestParam(required = false) Double insuranceCoverageRate,
            @RequestParam(required = false) Double monthlyIncome,
            @RequestParam(required = false) Double variableExpense,
            @RequestParam(required = false) Double currentSavings,
            @RequestParam(required = false) Double illnessRiskMultiplier,
            @RequestParam(required = false) Double seasonalIntensity,
            @RequestParam(required = false) Double impulseIntensity) {
        return ResponseEntity.ok(simulationService.runForUser(userId,
                new SimulationService.SimOverrides(age, insuranceCoverageRate, monthlyIncome, variableExpense,
                        currentSavings, illnessRiskMultiplier, seasonalIntensity, impulseIntensity)));
    }
}
