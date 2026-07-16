package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * インポートのプレビュー1行分。1つのCSV行/Markdown文書を解析した結果。
 * 保存はせず、取り込んだ場合にどうなるか（解決後の値・新規作成される参照）を表す。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportRowDto {
    /** 入力ファイル上の行番号（ヘッダを1とする）。 */
    private int line;
    /** "OK" | "WARNING" | "ERROR"。ERROR 行は取り込み時にスキップされる。 */
    private String status;
    /** 警告・エラーの内容（正常時は null）。 */
    private String message;

    private String date;          // 表示用（入力そのまま）
    private BigDecimal amount;    // 解析できない場合は null
    private String type;          // "INCOME" | "EXPENSE"
    private String category;
    private boolean newCategory;  // 取り込み時に新規作成されるカテゴリか
    private String store;         // 未指定なら null
    private boolean newStore;     // 取り込み時に新規作成される店舗か
    private String memo;
    private String note;
    private String pool;          // 表示用（"現金" / "主口座" / "主口座（未検出: X）" など）
    private boolean excludeFromSimulation;
}
