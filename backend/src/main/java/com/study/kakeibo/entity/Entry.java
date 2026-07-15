package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Data
@Entity
@NoArgsConstructor
@AllArgsConstructor
public class Entry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- 外部キー定義 ---
    @ManyToOne(fetch = FetchType.LAZY) // Entry:User = 多:1
    @JoinColumn(nullable = false) // 実際の外部キー列名を指定
    private User user;

    @Column(nullable = false)
    private LocalDate entryDate;

    @Column(nullable = false)
    private BigDecimal amount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    private Store store;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EntryType type;

    /** 品名（購入した物・明細）。OCRは「店舗\n商品, 値段…」形式を入れる。 */
    @Column
    private String memo;

    /** 自由記入のメモ欄。 */
    @Column
    private String note;

    /** どの資金プール（口座）の収支か。null は主口座(primary)扱い。 */
    @Column(name = "fund_pool_id")
    private Long fundPoolId;

    /**
     * シミュレーションの学習（月次収支の平均・振れ幅）から除外するか。
     * 手持ち残高を実額に合わせるための調整用エントリーなどに使う。
     * true でも口座残高・総資産には通常どおり反映される。
     */
    @Column(name = "exclude_from_simulation", nullable = false)
    private boolean excludeFromSimulation = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}