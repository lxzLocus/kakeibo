package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * 固定費（家賃・サブスクなど）。月額をシミュレーションの固定支出として合算する。
 */
@Data
@Entity
@Table(name = "fixed_cost")
@NoArgsConstructor
@AllArgsConstructor
public class FixedCost {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private BigDecimal amount;

    /** 毎月の支払日（1-31）。未指定可（未指定なら月初に記帳）。 */
    @Column
    private Integer paymentDay;

    /**
     * 毎月この固定費を収支（Entry）へ自動記帳するか。
     * 自動記帳したエントリは exclude_from_simulation=true で作る
     * （シミュレーションは固定費を別枠で加算するため、二重計上を避ける）。
     */
    @Column(name = "auto_post", nullable = false)
    private boolean autoPost = false;

    /** 自動記帳先のカテゴリID。null なら「固定費」カテゴリを自動作成して使う。 */
    @Column(name = "category_id")
    private Long categoryId;

    /** 支払い元プール（口座/カード）ID。null は主口座。カードを指定すると「カード払いの固定費」になる。 */
    @Column(name = "payment_pool_id")
    private Long paymentPoolId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
