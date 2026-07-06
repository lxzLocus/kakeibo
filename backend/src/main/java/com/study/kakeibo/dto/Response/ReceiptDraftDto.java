package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * レシートOCRの抽出結果（ドラフト）。フロントの確認画面で編集後、別途 /entries に登録する。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReceiptDraftDto {
    private String entryDate;              // yyyy-MM-dd（読み取れなければ null）
    private Long totalAmount;              // 合計金額（読み取れなければ null）
    private String storeName;
    private String suggestedCategoryName;
    private List<ReceiptItem> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReceiptItem {
        private String name;
        private Long price;
    }
}
