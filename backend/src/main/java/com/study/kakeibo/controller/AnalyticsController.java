package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Response.AnalysisResponseDto;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto;
import com.study.kakeibo.dto.Response.BenchmarkResponseDto;
import com.study.kakeibo.dto.Response.TrendResponseDto;
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

    /**
     * 収支・カテゴリ別支出の複数月推移を取得する。
     * 指定した年月を最新月として、直近 months ヶ月分（この月を含む）を返す。
     *
     * GET /analytics/trend?year=2026&month=7&months=6
     * Headers: X-User-Id: 1
     */
    @GetMapping("/trend")
    public ResponseEntity<TrendResponseDto> getTrend(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam int year,
            @RequestParam int month,
            @RequestParam(defaultValue = "6") int months
    ) {
        TrendResponseDto trend = analyticsService.getTrend(userId, year, month, months);
        return ResponseEntity.ok(trend);
    }

    /**
     * 「分析する」: 選択月の支出を自分の過去平均・中央値と比較する（コードベース・LLM不使用）。
     * GET /analytics/analyze?year=2026&month=7
     */
    @GetMapping("/analyze")
    public ResponseEntity<AnalysisResponseDto> analyze(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam int year,
            @RequestParam int month
    ) {
        return ResponseEntity.ok(analyticsService.analyze(userId, year, month));
    }

    /**
     * 「世帯平均との比較」: 選択月の支出構成比を、同年代平均・同収入帯平均と比較する
     * （家計調査ベースの概算参照値・LLM不使用）。収入は記録から直近3ヶ月平均で判定。
     *
     * GET /analytics/benchmark?year=2026&month=7&ageGroup=30代&household=SINGLE
     */
    @GetMapping("/benchmark")
    public ResponseEntity<BenchmarkResponseDto> getBenchmark(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam int year,
            @RequestParam int month,
            @RequestParam(required = false) String ageGroup,
            @RequestParam(required = false) String household
    ) {
        return ResponseEntity.ok(analyticsService.getBenchmark(userId, year, month, ageGroup, household));
    }
}
