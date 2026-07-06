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
     *
     * @param age 任意の現在年齢（病気リスク計算用）。省略時は30歳。
     */
    @GetMapping
    public ResponseEntity<SimulationResultDto> run(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) Integer age) {
        return ResponseEntity.ok(simulationService.runForUser(userId, age));
    }
}
