package com.study.kakeibo.repository;

import com.study.kakeibo.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findBySessionIdOrderByCreatedAtAscIdAsc(Long sessionId);

    java.util.Optional<ChatMessage> findByIdAndSessionId(Long id, Long sessionId);

    long countBySessionId(Long sessionId);

    long countBySessionIdAndRole(Long sessionId, String role);

    void deleteBySessionId(Long sessionId);

    /** 指定メッセージ以降（それを含む）をまとめて削除する（id は作成順に増加）。 */
    void deleteBySessionIdAndIdGreaterThanEqual(Long sessionId, Long id);
}
