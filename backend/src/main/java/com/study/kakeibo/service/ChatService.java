package com.study.kakeibo.service;

import com.study.kakeibo.dto.Response.AnalyticsResponseDto;
import com.study.kakeibo.entity.ChatMessage;
import com.study.kakeibo.entity.ChatSession;
import com.study.kakeibo.repository.ChatMessageRepository;
import com.study.kakeibo.repository.ChatSessionRepository;
import com.study.kakeibo.service.llm.LlmClient;
import com.study.kakeibo.service.llm.LlmConfig;
import com.study.kakeibo.service.llm.PromptLoaderService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * AIチャット機能。ユーザごとのLLM設定でChat Completionsを呼び出し、履歴を永続化する。
 */
@Service
public class ChatService {

    private static final String DEFAULT_TITLE = "新しいチャット";

    private final ChatSessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final LlmConfigService llmConfigService;
    private final LlmClient llmClient;
    private final PromptLoaderService promptLoader;
    private final AnalyticsService analyticsService;

    public ChatService(ChatSessionRepository sessionRepository,
                       ChatMessageRepository messageRepository,
                       LlmConfigService llmConfigService,
                       LlmClient llmClient,
                       PromptLoaderService promptLoader,
                       AnalyticsService analyticsService) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.llmConfigService = llmConfigService;
        this.llmClient = llmClient;
        this.promptLoader = promptLoader;
        this.analyticsService = analyticsService;
    }

    // --- セッション操作 ---

    @Transactional(readOnly = true)
    public List<ChatSession> listSessions(Long userId) {
        return sessionRepository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Transactional
    public ChatSession createSession(Long userId, String title) {
        ChatSession session = new ChatSession();
        session.setUserId(userId);
        session.setTitle(title == null || title.isBlank() ? DEFAULT_TITLE : title.trim());
        return sessionRepository.save(session);
    }

    @Transactional(readOnly = true)
    public ChatSession getSession(Long userId, Long sessionId) {
        return sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("チャットが見つかりません: " + sessionId));
    }

    @Transactional
    public ChatSession updateTitle(Long userId, Long sessionId, String title) {
        ChatSession session = getSession(userId, sessionId);
        session.setTitle(title.trim());
        return sessionRepository.save(session);
    }

    @Transactional
    public void deleteSession(Long userId, Long sessionId) {
        ChatSession session = getSession(userId, sessionId);
        messageRepository.deleteBySessionId(session.getId());
        sessionRepository.delete(session);
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> listMessages(Long userId, Long sessionId) {
        ChatSession session = getSession(userId, sessionId);
        return messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(session.getId());
    }

    /** メッセージ本文を編集する（所有チェックあり）。 */
    @Transactional
    public ChatMessage editMessage(Long userId, Long sessionId, Long messageId, String content) {
        ChatSession session = getSession(userId, sessionId); // 所有確認
        ChatMessage message = messageRepository.findByIdAndSessionId(messageId, session.getId())
                .orElseThrow(() -> new IllegalArgumentException("メッセージが見つかりません: " + messageId));
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("メッセージ本文を入力してください。");
        }
        message.setContent(content.trim());
        return messageRepository.save(message);
    }

    /** メッセージを削除する（所有チェックあり）。 */
    @Transactional
    public void deleteMessage(Long userId, Long sessionId, Long messageId) {
        ChatSession session = getSession(userId, sessionId); // 所有確認
        ChatMessage message = messageRepository.findByIdAndSessionId(messageId, session.getId())
                .orElseThrow(() -> new IllegalArgumentException("メッセージが見つかりません: " + messageId));
        messageRepository.delete(message);
    }

    public long countMessages(Long sessionId) {
        return messageRepository.countBySessionId(sessionId);
    }

    // --- メッセージ送信（LLM呼び出し） ---

    /**
     * ユーザーメッセージを保存→LLMへ問い合わせ→assistantメッセージを保存し、両方を返す。
     */
    @Transactional
    public SendResult sendMessage(Long userId, Long sessionId, String content,
                                  org.springframework.web.multipart.MultipartFile image) {
        ChatSession session = getSession(userId, sessionId);
        // チャット用のLLM設定を使用（未設定なら IllegalArgumentException(400)）
        LlmConfig llmConfig = llmConfigService.getDecryptedConfig(userId, com.study.kakeibo.entity.LlmPurpose.CHAT);

        boolean hasImage = image != null && !image.isEmpty();
        if (hasImage && !llmConfig.supportsVision()) {
            throw new IllegalArgumentException(
                    "このチャットモデルは画像に対応していません。設定で画像対応モデルを指定し「画像対応」をONにしてください。");
        }
        String text = content == null ? "" : content.trim();
        if (text.isEmpty() && !hasImage) {
            throw new IllegalArgumentException("メッセージを入力してください。");
        }

        // 1. 画像を保存 → ユーザーメッセージ保存
        String savedName = hasImage ? saveImage(image) : null;
        String contentType = hasImage ? image.getContentType() : null;
        ChatMessage userMessage = saveMessage(session.getId(), "user", text, savedName, contentType);

        // 2. 履歴を組み立て（systemプロンプト + 過去ログ。最新メッセージに画像があればマルチモーダル）
        List<ChatMessage> history = messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(session.getId());
        List<LlmClient.Message> apiMessages = buildApiMessages(userId, history);

        // 3. LLM呼び出し
        String reply = llmClient.chat(llmConfig, apiMessages, 2048);

        // 4. assistantメッセージ保存
        ChatMessage aiMessage = saveMessage(session.getId(), "assistant", reply.trim(), null, null);

        // 5. 初回のやり取りならタイトル自動生成
        if (DEFAULT_TITLE.equals(session.getTitle())) {
            generateTitleSafely(session, llmConfig, text.isEmpty() ? "画像の相談" : text);
        }

        // updatedAt を更新
        sessionRepository.save(session);

        return new SendResult(userMessage, aiMessage);
    }

    // ---- ストリーミング（SSE）用 ----

    /** ストリーミング送信の準備（ユーザーメッセージ保存＋LLMへ送るメッセージ列を用意）。 */
    @Transactional
    public StreamPrep prepareStream(Long userId, Long sessionId, String content,
                                    org.springframework.web.multipart.MultipartFile image) {
        ChatSession session = getSession(userId, sessionId);
        LlmConfig llmConfig = llmConfigService.getDecryptedConfig(userId, com.study.kakeibo.entity.LlmPurpose.CHAT);

        boolean hasImage = image != null && !image.isEmpty();
        if (hasImage && !llmConfig.supportsVision()) {
            throw new IllegalArgumentException(
                    "このチャットモデルは画像に対応していません。設定で画像対応モデルを指定し「画像対応」をONにしてください。");
        }
        String text = content == null ? "" : content.trim();
        if (text.isEmpty() && !hasImage) {
            throw new IllegalArgumentException("メッセージを入力してください。");
        }

        String savedName = hasImage ? saveImage(image) : null;
        String contentType = hasImage ? image.getContentType() : null;
        ChatMessage userMessage = saveMessage(session.getId(), "user", text, savedName, contentType);

        List<ChatMessage> history = messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(session.getId());
        List<LlmClient.Message> apiMessages = buildApiMessages(userId, history);
        String firstText = text.isEmpty() ? "画像の相談" : text;
        return new StreamPrep(userMessage, apiMessages, llmConfig, firstText);
    }

    /** LLMをストリーミング呼び出し。差分トークンごとに onChunk を呼び、本文全体を返す。 */
    public String streamReply(StreamPrep prep, java.util.function.Consumer<String> onChunk) {
        return llmClient.chatStream(prep.llmConfig(), prep.apiMessages(), 2048, onChunk);
    }

    /** ストリーミング完了後: assistantメッセージ保存＋タイトル生成。 */
    @Transactional
    public ChatMessage finalizeStream(Long userId, Long sessionId, LlmConfig llmConfig, String replyText, String firstText) {
        ChatSession session = getSession(userId, sessionId);
        ChatMessage aiMessage = saveMessage(session.getId(), "assistant", replyText.trim(), null, null);
        if (DEFAULT_TITLE.equals(session.getTitle())) {
            generateTitleSafely(session, llmConfig, firstText);
        }
        sessionRepository.save(session);
        return aiMessage;
    }

    public record StreamPrep(ChatMessage userMessage, List<LlmClient.Message> apiMessages,
                             LlmConfig llmConfig, String firstText) {
    }

    /** アップロード画像を ./chat-uploads/ に保存し、保存ファイル名を返す。 */
    private String saveImage(org.springframework.web.multipart.MultipartFile image) {
        String ct = image.getContentType();
        if (ct == null || !ct.startsWith("image/")) {
            throw new IllegalArgumentException("画像ファイルを指定してください。");
        }
        String ext = switch (ct) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
        try {
            java.nio.file.Path dir = java.nio.file.Path.of(com.study.kakeibo.config.WebConfig.UPLOAD_DIR);
            java.nio.file.Files.createDirectories(dir);
            String name = java.util.UUID.randomUUID() + ext;
            image.transferTo(dir.resolve(name).toAbsolutePath());
            return name;
        } catch (java.io.IOException e) {
            throw new RuntimeException("画像の保存に失敗しました: " + e.getMessage(), e);
        }
    }

    private ChatMessage saveMessage(Long sessionId, String role, String content, String imagePath, String contentType) {
        ChatMessage message = new ChatMessage();
        message.setSessionId(sessionId);
        message.setRole(role);
        message.setContent(content);
        message.setImagePath(imagePath);
        message.setContentType(contentType);
        return messageRepository.save(message);
    }

    private List<LlmClient.Message> buildApiMessages(Long userId, List<ChatMessage> history) {
        List<LlmClient.Message> apiMessages = new ArrayList<>();
        String systemPrompt = promptLoader.load("prompts/chat/system.md",
                Map.of("financialContext", buildFinancialContext(userId)));
        apiMessages.add(new LlmClient.Message("system", systemPrompt));

        int lastIndex = history.size() - 1;
        for (int i = 0; i < history.size(); i++) {
            ChatMessage m = history.get(i);
            // 最新メッセージに画像があればマルチモーダル(text + image)にする
            if (i == lastIndex && m.getImagePath() != null) {
                Object multimodal = buildImageContent(m);
                if (multimodal != null) {
                    apiMessages.add(new LlmClient.Message(m.getRole(), multimodal));
                    continue;
                }
            }
            apiMessages.add(new LlmClient.Message(m.getRole(), m.getContent()));
        }
        return apiMessages;
    }

    /** 画像付きメッセージを [テキスト, 画像(dataURL)] のマルチモーダル content にする。失敗時 null。 */
    private Object buildImageContent(ChatMessage m) {
        try {
            byte[] bytes = java.nio.file.Files.readAllBytes(
                    java.nio.file.Path.of(com.study.kakeibo.config.WebConfig.UPLOAD_DIR, m.getImagePath()));
            String ct = (m.getContentType() != null && m.getContentType().startsWith("image/"))
                    ? m.getContentType() : "image/jpeg";
            String dataUrl = "data:" + ct + ";base64," + java.util.Base64.getEncoder().encodeToString(bytes);
            String text = (m.getContent() == null || m.getContent().isBlank()) ? "この画像について相談したいです。" : m.getContent();
            return java.util.List.of(
                    new LlmClient.TextPart(text),
                    new LlmClient.ImagePart(new LlmClient.ImageUrl(dataUrl)));
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 直近月の集計を短い文章にして家計コンテキストとして注入する。失敗しても無視。
     */
    private String buildFinancialContext(Long userId) {
        try {
            LocalDate now = LocalDate.now();
            AnalyticsResponseDto summary = analyticsService.getMonthlySummary(userId, now.getYear(), now.getMonthValue());
            StringBuilder sb = new StringBuilder();
            sb.append(summary.getMonth()).append("の状況: ")
                    .append("収入 ").append(summary.getTotalIncome()).append("円, ")
                    .append("支出 ").append(summary.getTotalExpense()).append("円, ")
                    .append("収支 ").append(summary.getBalance()).append("円。");
            if (summary.getByCategory() != null && !summary.getByCategory().isEmpty()) {
                sb.append(" 主な支出カテゴリ: ");
                summary.getByCategory().stream().limit(3).forEach(c ->
                        sb.append(c.getName()).append("(").append(c.getAmount()).append("円) "));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private void generateTitleSafely(ChatSession session, LlmConfig llmConfig, String firstUserMessage) {
        try {
            String prompt = "次の家計相談の最初のメッセージから、15文字以内の簡潔な日本語のタイトルだけを返してください（記号や引用符は不要）:\n"
                    + firstUserMessage;
            String title = llmClient.chat(llmConfig,
                    List.of(new LlmClient.Message("user", prompt)), 64);
            title = title.trim().replaceAll("^[\"'「『]|[\"'」』]$", "");
            if (title.length() > 30) {
                title = title.substring(0, 30);
            }
            if (!title.isBlank()) {
                session.setTitle(title);
            }
        } catch (Exception e) {
            // タイトル生成は失敗しても致命的でないため無視
        }
    }

    public record SendResult(ChatMessage userMessage, ChatMessage aiMessage) {
    }
}
