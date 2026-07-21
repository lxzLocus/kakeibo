package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * 資金プール（口座）。ユーザーが名前を付けて複数作成できる（メイン/投資用 など）。
 * 現在残高は initialBalance + そのプールの収支 + 振替 から動的に計算する（保存しない）。
 */
@Data
@Entity
@Table(name = "fund_pool")
@NoArgsConstructor
@AllArgsConstructor
public class FundPool {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String name;

    /** 種別: BANK(銀行) / CASH(現金) / CARD(クレジットカード)。 */
    @Column(name = "kind", nullable = false, length = 16)
    private String kind = "BANK";

    /** 表示色（カードのブランドカラー等の16進。null は種別の既定色）。 */
    @Column(name = "color", length = 16)
    private String color;

    // --- カード(kind=CARD)の引き落とし設定 ---

    /** 締め日 (1-31, null は月末締め)。 */
    @Column(name = "closing_day")
    private Integer closingDay;

    /** 引き落とし日 (1-31)。 */
    @Column(name = "payment_day")
    private Integer paymentDay;

    /** 引き落とし元の口座（銀行プール）ID。 */
    @Column(name = "settlement_pool_id")
    private Long settlementPoolId;

    /** 締め→引き落としの振替を自動生成するか。 */
    @Column(name = "auto_settle", nullable = false)
    private boolean autoSettle = false;

    /** 開始残高（この口座の起点となる手動入力の金額）。 */
    @Column(name = "initial_balance", nullable = false, precision = 15, scale = 2)
    private BigDecimal initialBalance = BigDecimal.ZERO;

    /** 主口座（収支の既定の紐づけ先。1ユーザ1件）。 */
    @Column(name = "is_primary", nullable = false)
    private boolean primary = false;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
