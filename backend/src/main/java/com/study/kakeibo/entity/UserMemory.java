package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * チャットが会話から自動学習する「ユーザーメモリ」。
 * ユーザー1人につき1行。永続的な事実・好み・方針をLLMが抽出・統合して更新する。
 * （ユーザーが手動で設定するものではない。Gemini/ChatGPT のメモリ機能に相当）
 */
@Data
@Entity
@Table(name = "user_memory")
@NoArgsConstructor
@AllArgsConstructor
public class UserMemory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(columnDefinition = "TEXT")
    private String content;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
