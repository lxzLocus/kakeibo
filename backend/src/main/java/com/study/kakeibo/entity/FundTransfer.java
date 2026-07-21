package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

/**
 * 資金プール間の振替（例: メイン口座→投資用口座）。総資産は変化しない net-zero 操作。
 * 残高への影響は計算時に fromPool を減算・toPool を加算して反映する。
 */
@Data
@Entity
@Table(name = "fund_transfer")
@NoArgsConstructor
@AllArgsConstructor
public class FundTransfer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "from_pool_id", nullable = false)
    private Long fromPoolId;

    @Column(name = "to_pool_id", nullable = false)
    private Long toPoolId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "transfer_date", nullable = false)
    private LocalDate transferDate;

    @Column
    private String memo;

    /** カード自動引き落としで生成した振替なら対象カードのID（手動振替は null）。冪等判定に使う。 */
    @Column(name = "auto_card_id")
    private Long autoCardId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
