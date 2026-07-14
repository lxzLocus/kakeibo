package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.CreateChatRequestDto;
import com.study.kakeibo.dto.Request.SendMessageRequestDto;
import com.study.kakeibo.dto.Request.UpdateChatTitleRequestDto;
import com.study.kakeibo.dto.Response.ChatMessageResponseDto;
import com.study.kakeibo.dto.Response.ChatSessionResponseDto;
import com.study.kakeibo.dto.Response.SendMessageResponseDto;
import com.study.kakeibo.entity.ChatMessage;
import com.study.kakeibo.entity.ChatSession;
import com.study.kakeibo.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/chats")
public class ChatController {

    private final ChatService chatService;
    private final ExecutorService sseExecutor = Executors.newCachedThreadPool();

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    // --- DTO変換 ---
    private ChatSessionResponseDto toDto(ChatSession s) {
        return new ChatSessionResponseDto(
                s.getId(), s.getTitle(), chatService.countMessages(s.getId()),
                s.getCreatedAt(), s.getUpdatedAt());
    }

    private ChatMessageResponseDto toDto(ChatMessage m) {
        String imageUrl = m.getImagePath() != null ? "/api/images/" + m.getImagePath() : null;
        return new ChatMessageResponseDto(
                m.getId(), m.getSessionId(), m.getRole(), m.getContent(), imageUrl, m.getCreatedAt());
    }

    // --- セッション ---

    @GetMapping
    public ResponseEntity<List<ChatSessionResponseDto>> list(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(chatService.listSessions(userId).stream().map(this::toDto).toList());
    }

    @PostMapping
    public ResponseEntity<ChatSessionResponseDto> create(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody(required = false) CreateChatRequestDto request) {
        String title = request == null ? null : request.getTitle();
        ChatSession session = chatService.createSession(userId, title);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(session));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<ChatSessionResponseDto> get(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long sessionId) {
        return ResponseEntity.ok(toDto(chatService.getSession(userId, sessionId)));
    }

    @PatchMapping("/{sessionId}")
    public ResponseEntity<ChatSessionResponseDto> updateTitle(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long sessionId,
            @Valid @RequestBody UpdateChatTitleRequestDto request) {
        return ResponseEntity.ok(toDto(chatService.updateTitle(userId, sessionId, request.getTitle())));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long sessionId) {
        chatService.deleteSession(userId, sessionId);
        return ResponseEntity.noContent().build();
    }

    // --- メッセージ ---

    @GetMapping("/{sessionId}/messages")
    public ResponseEntity<List<ChatMessageResponseDto>> listMessages(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long sessionId) {
        return ResponseEntity.ok(chatService.listMessages(userId, sessionId).stream().map(this::toDto).toList());
    }

    // メッセージ送信（テキスト＋任意で画像1枚。multipart）
    @PostMapping(value = "/{sessionId}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SendMessageResponseDto> sendMessage(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long sessionId,
            @RequestParam(value = "content", required = false, defaultValue = "") String content,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        ChatService.SendResult result = chatService.sendMessage(userId, sessionId, content, file);
        return ResponseEntity.ok(new SendMessageResponseDto(
                toDto(result.userMessage()), toDto(result.aiMessage()), result.relatedQuestions()));
    }

    // メッセージ送信（ストリーミング / SSE）。events: user → chunk* → done / error
    @PostMapping(value = "/{sessionId}/messages/stream", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SseEmitter sendMessageStream(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long sessionId,
            @RequestParam(value = "content", required = false, defaultValue = "") String content,
            @RequestParam(value = "file", required = false) MultipartFile file) {

        SseEmitter emitter = new SseEmitter(180_000L);
        sseExecutor.submit(() -> {
            try {
                ChatService.StreamPrep prep = chatService.prepareStream(userId, sessionId, content, file);
                emitter.send(SseEmitter.event().name("user").data(toDto(prep.userMessage())));

                String reply = chatService.streamReply(prep, piece -> {
                    try {
                        emitter.send(SseEmitter.event().name("chunk").data(Map.of("text", piece)));
                    } catch (IOException e) {
                        throw new ClientGoneException(e); // クライアント切断
                    }
                });

                ChatService.FinalizeResult fin = chatService.finalizeStream(
                        userId, sessionId, prep.llmConfig(), reply, prep.firstText());
                emitter.send(SseEmitter.event().name("done").data(toDto(fin.aiMessage())));
                // 最初の数ターンのみ関連質問を送る（画面下部に表示）
                if (fin.relatedQuestions() != null && !fin.relatedQuestions().isEmpty()) {
                    emitter.send(SseEmitter.event().name("related")
                            .data(Map.of("questions", fin.relatedQuestions())));
                }
                emitter.complete();
            } catch (ClientGoneException gone) {
                emitter.complete();
            } catch (Exception ex) {
                try {
                    String msg = ex.getMessage() != null ? ex.getMessage() : "エラーが発生しました";
                    emitter.send(SseEmitter.event().name("error").data(Map.of("message", msg)));
                } catch (IOException ignore) {
                    // 送れなければ諦める
                }
                emitter.complete();
            }
        });
        return emitter;
    }

    /** チャンク送信中にクライアントが切断した場合の内部例外 */
    private static class ClientGoneException extends RuntimeException {
        ClientGoneException(Throwable cause) {
            super(cause);
        }
    }

    // メッセージ編集
    @PatchMapping("/{sessionId}/messages/{messageId}")
    public ResponseEntity<ChatMessageResponseDto> editMessage(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long sessionId,
            @PathVariable Long messageId,
            @Valid @RequestBody SendMessageRequestDto request) {
        ChatMessage updated = chatService.editMessage(userId, sessionId, messageId, request.getContent());
        return ResponseEntity.ok(toDto(updated));
    }

    // メッセージ削除
    @DeleteMapping("/{sessionId}/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long sessionId,
            @PathVariable Long messageId) {
        chatService.deleteMessage(userId, sessionId, messageId);
        return ResponseEntity.noContent().build();
    }
}
