package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 評価バッチの設定・状態（設定画面用）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationResponseDto {
    private String frequency;   // OFF / DAILY / WEEKLY / MONTHLY
    private String lastRunAt;   // 最終実行時刻 (ISO-8601) / 未実行なら null
    private String summary;     // 最終実行の代表的な所見（null可）
}
