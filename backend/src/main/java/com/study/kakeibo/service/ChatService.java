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

    /** 逐語で常に残す直近メッセージ数（要約対象から除外）。 */
    private static final int KEEP_RECENT_MESSAGES = 6;
    /** 逐語履歴の合計文字数がこれを超えたら古い部分を要約する（おおよそのトークン肥大化対策）。 */
    private static final int SUMMARY_TRIGGER_CHARS = 4000;
    /** 関連質問を生成するのは最初の何ターン（assistant返信）までか。 */
    private static final int RELATED_MAX_TURNS = 2;
    /** 生成する関連質問の数。 */
    private static final int RELATED_QUESTION_COUNT = 3;

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

    /**
     * メッセージを削除する（所有チェックあり）。
     * このメッセージ以降（それを含む）をまとめて削除する。
     * 例: ユーザーメッセージを消すと、それへのAI返信や以降の履歴も消える。
     */
    @Transactional
    public void deleteMessage(Long userId, Long sessionId, Long messageId) {
        ChatSession session = getSession(userId, sessionId); // 所有確認
        ChatMessage message = messageRepository.findByIdAndSessionId(messageId, session.getId())
                .orElseThrow(() -> new IllegalArgumentException("メッセージが見つかりません: " + messageId));
        messageRepository.deleteBySessionIdAndIdGreaterThanEqual(session.getId(), message.getId());
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

        // 2. 履歴を組み立て（systemプロンプト + 要約 + 過去ログ。肥大化時は古い部分を要約）
        List<ChatMessage> history = messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(session.getId());
        List<LlmClient.Message> apiMessages = buildApiMessages(userId, session, history, llmConfig);

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

        // 6. 最初の数ターンのみ関連質問を生成
        List<String> related = maybeGenerateRelated(session.getId(), llmConfig);

        return new SendResult(userMessage, aiMessage, related);
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
        List<LlmClient.Message> apiMessages = buildApiMessages(userId, session, history, llmConfig);
        String firstText = text.isEmpty() ? "画像の相談" : text;
        return new StreamPrep(userMessage, apiMessages, llmConfig, firstText);
    }

    /** LLMをストリーミング呼び出し。差分トークンごとに onChunk を呼び、本文全体を返す。 */
    public String streamReply(StreamPrep prep, java.util.function.Consumer<String> onChunk) {
        return llmClient.chatStream(prep.llmConfig(), prep.apiMessages(), 2048, onChunk);
    }

    /** ストリーミング完了後: assistantメッセージ保存＋タイトル生成＋（最初の数ターンのみ）関連質問生成。 */
    @Transactional
    public FinalizeResult finalizeStream(Long userId, Long sessionId, LlmConfig llmConfig, String replyText, String firstText) {
        ChatSession session = getSession(userId, sessionId);
        ChatMessage aiMessage = saveMessage(session.getId(), "assistant", replyText.trim(), null, null);
        if (DEFAULT_TITLE.equals(session.getTitle())) {
            generateTitleSafely(session, llmConfig, firstText);
        }
        sessionRepository.save(session);
        List<String> related = maybeGenerateRelated(session.getId(), llmConfig);
        return new FinalizeResult(aiMessage, related);
    }

    public record StreamPrep(ChatMessage userMessage, List<LlmClient.Message> apiMessages,
                             LlmConfig llmConfig, String firstText) {
    }

    public record FinalizeResult(ChatMessage aiMessage, List<String> relatedQuestions) {
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

    /**
     * LLMへ送るメッセージ列を組み立てる。
     * 逐語履歴が肥大化していたら古い部分を要約してセッションに保存し、要約は system プロンプトに注入する
     * （要約はフロントには返さない）。要約済み以降のメッセージのみ逐語で送る。
     */
    private List<LlmClient.Message> buildApiMessages(Long userId, ChatSession session,
                                                     List<ChatMessage> history, LlmConfig llmConfig) {
        // 1. 必要なら古い履歴を要約（session.summary / summarizedUntilMessageId を更新）
        maybeSummarize(session, history, llmConfig);

        // 2. systemプロンプト（家計コンテキスト + これまでの会話要約を内包）
        String systemPrompt = promptLoader.load("prompts/chat/system.md",
                Map.of("financialContext", buildFinancialContext(userId)));
        if (session.getSummary() != null && !session.getSummary().isBlank()) {
            systemPrompt = systemPrompt
                    + "\n\n# これまでの会話の要約（参考。ユーザーには表示されていません）\n"
                    + session.getSummary();
        }

        List<LlmClient.Message> apiMessages = new ArrayList<>();
        apiMessages.add(new LlmClient.Message("system", systemPrompt));

        // 3. 要約済み境界より後のメッセージのみ逐語で追加
        long until = session.getSummarizedUntilMessageId() == null ? 0L : session.getSummarizedUntilMessageId();
        List<ChatMessage> verbatim = history.stream().filter(m -> m.getId() > until).toList();
        int lastIndex = verbatim.size() - 1;
        for (int i = 0; i < verbatim.size(); i++) {
            ChatMessage m = verbatim.get(i);
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

    /**
     * 逐語履歴（要約済み以降）が大きくなったら、直近 {@link #KEEP_RECENT_MESSAGES} 件を残して
     * それ以前をLLMで要約し、session.summary / summarizedUntilMessageId を更新する。
     * 失敗時は要約せず逐語のまま続行（境界は進めないので履歴は失われない）。
     */
    private void maybeSummarize(ChatSession session, List<ChatMessage> history, LlmConfig llmConfig) {
        long until = session.getSummarizedUntilMessageId() == null ? 0L : session.getSummarizedUntilMessageId();
        List<ChatMessage> verbatim = history.stream().filter(m -> m.getId() > until).toList();
        if (verbatim.size() <= KEEP_RECENT_MESSAGES) {
            return;
        }
        int chars = verbatim.stream().mapToInt(m -> m.getContent() == null ? 0 : m.getContent().length()).sum();
        if (chars <= SUMMARY_TRIGGER_CHARS) {
            return;
        }
        List<ChatMessage> toSummarize = verbatim.subList(0, verbatim.size() - KEEP_RECENT_MESSAGES);
        if (toSummarize.isEmpty()) {
            return;
        }
        try {
            String newSummary = summarizeConversation(session.getSummary(), toSummarize, llmConfig);
            if (newSummary != null && !newSummary.isBlank()) {
                session.setSummary(newSummary.trim());
                session.setSummarizedUntilMessageId(toSummarize.get(toSummarize.size() - 1).getId());
                sessionRepository.save(session);
            }
        } catch (Exception e) {
            // 要約はベストエフォート。失敗しても会話は継続する。
        }
    }

    /** これまでの要約と追加の会話を、後続の文脈保持に使える短い要約にまとめる。 */
    private String summarizeConversation(String existingSummary, List<ChatMessage> messages, LlmConfig llmConfig) {
        StringBuilder convo = new StringBuilder();
        for (ChatMessage m : messages) {
            convo.append("user".equals(m.getRole()) ? "ユーザー: " : "アシスタント: ")
                    .append(m.getContent() == null ? "" : m.getContent()).append("\n");
        }
        String prompt = "あなたは家計相談チャットの会話を要約するアシスタントです。\n"
                + "後続の応答で文脈を保てるよう、会話の要点（ユーザーの家計状況・相談内容・アシスタントの助言や結論）を"
                + "日本語で簡潔にまとめてください。箇条書き可、全体で300文字程度。挨拶や相づちは省きます。\n\n"
                + "[これまでの要約（無ければ空）]\n" + (existingSummary == null ? "" : existingSummary) + "\n\n"
                + "[追加の会話]\n" + convo + "\n"
                + "[更新後の要約のみを出力]";
        return llmClient.chat(llmConfig, List.of(new LlmClient.Message("user", prompt)), 512);
    }

    /** 最初の {@link #RELATED_MAX_TURNS} ターンまでのみ、関連質問を生成する。失敗時は空リスト。 */
    private List<String> maybeGenerateRelated(Long sessionId, LlmConfig llmConfig) {
        long assistantCount = messageRepository.countBySessionIdAndRole(sessionId, "assistant");
        if (assistantCount > RELATED_MAX_TURNS) {
            return List.of();
        }
        try {
            List<ChatMessage> history = messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(sessionId);
            int from = Math.max(0, history.size() - 6);
            StringBuilder convo = new StringBuilder();
            for (ChatMessage m : history.subList(from, history.size())) {
                convo.append("user".equals(m.getRole()) ? "ユーザー: " : "アシスタント: ")
                        .append(m.getContent() == null ? "" : m.getContent()).append("\n");
            }
            String prompt = "次は家計相談チャットの会話です。この流れでユーザーが次に尋ねそうな短い質問を"
                    + RELATED_QUESTION_COUNT + "つ提案してください。\n"
                    + "各質問は日本語で15〜30文字程度、1行に1つ、番号・記号・引用符なしで出力してください。\n\n"
                    + convo + "\n質問(" + RELATED_QUESTION_COUNT + "つ):";
            String raw = llmClient.chat(llmConfig, List.of(new LlmClient.Message("user", prompt)), 256);
            return parseQuestions(raw);
        } catch (Exception e) {
            return List.of();
        }
    }

    /** LLMの複数行出力を、番号や記号を除いた質問リスト（最大 RELATED_QUESTION_COUNT 件）にする。 */
    private List<String> parseQuestions(String raw) {
        if (raw == null) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String line : raw.split("\\r?\\n")) {
            String q = line.trim()
                    .replaceAll("^[0-9０-９]+[.．)）、:：\\-\\s]*", "")
                    .replaceAll("^[「『\"'・\\-*\\s]+", "")
                    .replaceAll("[」』\"']+$", "")
                    .trim();
            if (!q.isBlank()) {
                out.add(q);
            }
            if (out.size() >= RELATED_QUESTION_COUNT) {
                break;
            }
        }
        return out;
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

    public record SendResult(ChatMessage userMessage, ChatMessage aiMessage, List<String> relatedQuestions) {
    }
}
