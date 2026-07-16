package com.study.kakeibo.service;

import com.study.kakeibo.dto.Response.ImportPreviewDto;
import com.study.kakeibo.dto.Response.ImportResultDto;

public interface ImportService {

    /**
     * CSV またはMarkdown テキストを解析し、エントリを一括登録する。
     *
     * @param userId  ユーザーID
     * @param format  "csv" or "markdown"
     * @param content テキスト本文
     * @return インポート結果
     */
    ImportResultDto importData(Long userId, String format, String content);

    /**
     * 取り込みのプレビュー（保存しない）。行ごとの解析結果と集計を返す。
     *
     * @param userId  ユーザーID
     * @param format  "csv" or "markdown"
     * @param content テキスト本文
     * @return プレビュー結果
     */
    ImportPreviewDto preview(Long userId, String format, String content);
}
