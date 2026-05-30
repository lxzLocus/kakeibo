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
public class Inventory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String itemName;

    @Column(nullable = false)
    private BigDecimal quantity;

    @Column
    private String unit;

    @Column
    private BigDecimal purchasePrice;

    @Column
    private LocalDate purchaseDate;

    @Column
    private LocalDate expiryDate;

    @Enumerated(EnumType.STRING)
    @Column
    private StorageType storage;

    @Column(nullable = false)
    private Boolean isConsumed = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
