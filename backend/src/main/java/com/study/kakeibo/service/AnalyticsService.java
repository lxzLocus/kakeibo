package com.study.kakeibo.service;

import com.study.kakeibo.dto.Response.AnalysisResponseDto;
import com.study.kakeibo.dto.Response.AnalyticsResponseDto;
import com.study.kakeibo.dto.Response.BenchmarkResponseDto;
import com.study.kakeibo.dto.Response.TrendResponseDto;

public interface AnalyticsService {

    /**
     * 選択月の支出を、ユーザー自身の過去の平均・中央値と比較する（コードベース・LLM不使用）。
     */
    AnalysisResponseDto analyze(Long userId, int year, int month);

    /**
     * 選択月の支出構成比を、世帯平均（同年代・同収入帯）と比較する（家計調査ベースの概算・LLM不使用）。
     *
     * @param ageGroup  年代（"30代" 等。未設定なら null → 同年代比較は省略）
     * @param household 世帯区分（"SINGLE" | "FAMILY"。未知は単身）
     */
    BenchmarkResponseDto getBenchmark(Long userId, int year, int month, String ageGroup, String household);

    /**
     * 指定されたユーザーの月次サマリーを取得する。
     * カテゴリ別・店舗別の集計、および日別推移データを含む。
     *
     * @param userId ユーザーID
     * @param year   対象年
     * @param month  対象月 (1-12)
     * @return 月次分析サマリー
     */
    AnalyticsResponseDto getMonthlySummary(Long userId, int year, int month);

    /**
     * 指定された月を最新月として、直近 {@code months} ヶ月分の収支・カテゴリ別支出の推移を取得する。
     *
     * @param userId ユーザーID
     * @param year   最新月の年
     * @param month  最新月 (1-12)
     * @param months 遡る月数（この月を含む。1〜24にクランプ）
     * @return 推移サマリー
     */
    TrendResponseDto getTrend(Long userId, int year, int month, int months);
}
