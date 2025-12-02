package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Entry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- 外部キー定義 ---
    @ManyToOne(fetch = FetchType.LAZY) // Entry:User = 多:1
    @JoinColumn(name = "user_id", nullable = false) // 実際の外部キー列名を指定
    private User user;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(nullable = false)
    private Double amount; // DECIMAL(10,2)なら Double or BigDecimal 推奨

    @Column(nullable = false)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EntryType type;
    
    @Column
    private String memo;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}