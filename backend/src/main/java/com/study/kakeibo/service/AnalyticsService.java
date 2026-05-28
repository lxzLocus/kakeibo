package com.study.kakeibo.service;

import com.study.kakeibo.dto.Response.AnalyticsResponseDto;

public interface AnalyticsService {

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
}
