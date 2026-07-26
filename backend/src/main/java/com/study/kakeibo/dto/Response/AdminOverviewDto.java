package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 「管理」ビュー用。アプリが裏で自動管理しているデータ（LLMの自動判定・学習メモリ・
 * 評価バッチ・固定費の自動記帳・カード決済振替・プールの内部設定など）を読み取り専用で集約する。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminOverviewDto {

    private Counts counts;
    private List<LlmInfo> llm;
    private MemoryInfo memory;
    private EvaluationInfo evaluation;
    private AutomationInfo automation;
    private List<PoolInfo> pools;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Counts {
        private long entries;
        private long categories;
        private long stores;
        private long pools;
        private long transfers;
        private long fixedCosts;
        private long chatSessions;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LlmInfo {
        private String purpose;        // CHAT / VISION
        private boolean configured;
        private String model;
        private String baseUrl;
        private boolean supportsVision;
        private Boolean supportsTools;  // null=未判定 / true / false（自動判定の結果）
        private boolean directOcr;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MemoryInfo {
        private boolean present;
        private int length;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class EvaluationInfo {
        private String frequency;       // OFF / DAILY / WEEKLY / MONTHLY
        private LocalDateTime lastRunAt;
        private String summary;         // 最終評価の所見（コードベース分析のハイライト）
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AutomationInfo {
        private long fixedCostPostedEntries; // 固定費から自動記帳された取引件数
        private long cardSettlementTransfers; // カード自動引き落としの振替件数
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PoolInfo {
        private Long id;
        private String name;
        private String kind;            // BANK / CASH / CARD
        private boolean primary;
        private Integer closingDay;     // カードの締め日
        private Integer paymentDay;     // カードの引き落とし日
        private Long settlementPoolId;  // 引き落とし元プール
        private boolean autoSettle;     // 自動引き落としON
    }
}
