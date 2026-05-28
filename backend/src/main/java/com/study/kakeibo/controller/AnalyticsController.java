package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Response.AnalyticsResponseDto;
import com.study.kakeibo.service.AnalyticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/analytics")
public class AnalyticsController {

    @Autowired
    private AnalyticsService analyticsService;

    /**
     * 月次サマリーを取得する。
     * カテゴリ別・店舗別の集計、および日別推移データを含む。
     *
     * GET /analytics/monthly?year=2026&month=5
     * Headers: X-User-Id: 1
     */
    @GetMapping("/monthly")
    public ResponseEntity<AnalyticsResponseDto> getMonthlySummary(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam int year,
            @RequestParam int month
    ) {
        AnalyticsResponseDto summary = analyticsService.getMonthlySummary(userId, year, month);
        return ResponseEntity.ok(summary);
    }
}
