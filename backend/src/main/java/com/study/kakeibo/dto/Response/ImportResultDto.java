package com.study.kakeibo.dto.Response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.List;

/**
 * インポート結果レスポンス DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportResultDto {
    private int totalRows;                  // 処理した行数
    private int successCount;               // 成功件数
    private int errorCount;                 // エラー件数
    private List<String> errors;            // エラー詳細（行番号 + 理由）
    private List<Long> createdEntryIds;     // 作成されたエントリID一覧
}
