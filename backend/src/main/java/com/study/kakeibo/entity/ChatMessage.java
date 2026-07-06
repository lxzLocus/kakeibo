package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

/**
 * AIチャットの1メッセージ。role は "user" / "assistant" / "system"。
 */
@Data
@Entity
@Table(name = "chat_message")
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(nullable = false, length = 16)
    private String role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** 添付画像の保存ファイル名（./chat-uploads/ 配下）。無ければ null。 */
    @Column(name = "image_path")
    private String imagePath;

    @Column(name = "content_type")
    private String contentType;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
