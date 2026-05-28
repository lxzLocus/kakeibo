package com.study.kakeibo.service;

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
}
