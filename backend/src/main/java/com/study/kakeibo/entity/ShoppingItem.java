package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * 買い物リストの1アイテム（todo）。品名を登録するとLLMが数量・価格の目安を推定する。
 */
@Data
@Entity
@Table(name = "shopping_item")
@NoArgsConstructor
@AllArgsConstructor
public class ShoppingItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String name;

    /** LLMが推定した数量・容量の目安（例: "12ロール"）。未推定なら null。 */
    @Column
    private String quantity;

    /** LLMが推定したおおよその価格（円）。未推定なら null。 */
    @Column(name = "estimated_price")
    private Integer estimatedPrice;

    /** 購入済みチェック（todo）。 */
    @Column(nullable = false)
    private boolean checked = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
