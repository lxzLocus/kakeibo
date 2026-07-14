package com.study.kakeibo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * AIチャットのセッション（スレッド）。
 */
@Data
@Entity
@Table(name = "chat_session")
@NoArgsConstructor
@AllArgsConstructor
public class ChatSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    /**
     * トークン肥大化対策の会話要約。summarizedUntilMessageId までのメッセージを要約したもの。
     * LLMコンテキストにのみ注入し、フロントには返さない。
     */
    @Column(columnDefinition = "TEXT")
    private String summary;

    /** summary が対象とする最後の chat_message.id。null なら未要約。 */
    @Column(name = "summarized_until_message_id")
    private Long summarizedUntilMessageId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
