package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * インポートのプレビュー結果（保存なし）。
 * 行ごとの解析結果と集計を返し、フロントで確認してから実際の取り込みを行う。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportPreviewDto {
    private int totalRows;      // 解析したデータ行数
    private int okCount;        // 問題なく取り込める行
    private int warningCount;   // 取り込むが注意がある行（例: 口座未検出→主口座）
    private int errorCount;     // 取り込めない行（スキップ）
    /** ヘッダ不正・空ファイル等の致命的エラー（正常時は null）。 */
    private String headerError;
    private List<ImportRowDto> rows;
}
