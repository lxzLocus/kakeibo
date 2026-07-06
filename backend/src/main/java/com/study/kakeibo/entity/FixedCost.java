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

    /** 毎月の支払日（1-31）。未指定可。 */
    @Column
    private Integer paymentDay;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
