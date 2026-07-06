package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * ユーザごとのLLM接続設定。APIキーは暗号化して保存する（apiKeyEnc）。
 * 用途(purpose)ごとに1レコード（(user_id, purpose) がユニーク）。
 * 例: CHAT=DeepSeek, VISION=Qwen のように別プロバイダを設定できる。
 */
@Data
@Entity
@Table(name = "user_llm_config",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_purpose", columnNames = {"user_id", "purpose"}))
@NoArgsConstructor
@AllArgsConstructor
public class UserLlmConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private LlmPurpose purpose;

    @Column(nullable = false)
    private String baseUrl;

    @Column(nullable = false)
    private String model;

    /** 暗号化済みのAPIキー（TextEncryptorで暗号化） */
    @Column(name = "api_key_enc", nullable = false, columnDefinition = "TEXT")
    private String apiKeyEnc;

    /** このモデルが画像入力(Vision)に対応するか。チャットの画像送信の可否に使う。 */
    @Column(name = "supports_vision", nullable = false)
    private boolean supportsVision = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
