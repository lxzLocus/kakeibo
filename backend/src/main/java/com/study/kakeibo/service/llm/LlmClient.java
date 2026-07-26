package com.study.kakeibo.service.llm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.study.kakeibo.exception.LlmException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Stream;

/**
 * OpenAI互換 Chat Completions API を叩く共通クライアント。
 * 認証情報（baseUrl / model / apiKey）はグローバルではなく、呼び出しごとに {@link LlmConfig} で受け取る。
 * これによりユーザごとに保存したAPIキーを利用できる。
 */
@Component
public class LlmClient {

    private final RestClient restClient = RestClient.create();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();
    private final ObjectMapper objectMapper;

    public LlmClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // --- メッセージ構造（OpenAI互換） ---
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Message(String role, Object content) {
    }

    public record TextPart(String type, String text) {
        public TextPart(String text) {
            this("text", text);
        }
    }

    public record ImagePart(String type, ImageUrl image_url) {
        public ImagePart(ImageUrl image_url) {
            this("image_url", image_url);
        }
    }

    public record ImageUrl(String url) {
    }

    // --- レスポンス構造 ---
    public record ChatResponse(List<Choice> choices) {
    }

    public record Choice(ResponseMessage message) {
    }

    public record ResponseMessage(String role, String content) {
    }

    /**
     * テキストメッセージ列でLLMを呼び出し、assistantの本文を返す。
     */
    public String chat(LlmConfig config, List<Message> messages, Integer maxCompletionTokens) {
        validate(config);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", config.model());
        payload.put("messages", messages);
        if (maxCompletionTokens != null) {
            payload.put("max_completion_tokens", maxCompletionTokens);
        }

        String endpoint = resolveEndpoint(config.baseUrl());
        ChatResponse response;
        try {
            response = restClient.post()
                    .uri(endpoint)
                    .header("Authorization", "Bearer " + config.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(ChatResponse.class);
        } catch (RestClientResponseException e) {
            // HTTPステータス付きのエラー（4xx/5xx）。原因が分かるメッセージに整形する。
            throw new LlmException(describeHttpError(e, endpoint, config.model()));
        } catch (Exception e) {
            // 接続不可・タイムアウト・JSONデシリアライズ失敗など
            throw new LlmException("LLM APIに接続できませんでした（接続先: " + endpoint + "）: " + e.getMessage());
        }

        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            throw new LlmException("LLMからのレスポンスが空でした。モデル名（" + config.model()
                    + "）やベースURLが正しいか確認してください。");
        }
        ResponseMessage message = response.choices().get(0).message();
        if (message == null || message.content() == null) {
            throw new LlmException("LLMからの返答本文が空でした（モデル: " + config.model() + "）。");
        }
        return message.content();
    }

    /**
     * ツール（関数呼び出し）付きでLLMを呼び出す。モデルがツールを要求したら {@code toolExecutor} で実行し、
     * 結果を会話に足して再度問い合わせる、を最終回答が出るまで繰り返す（最大数回）。
     * このメソッド自体は成否を判定せず、ツール非対応エンドポイントでは例外を投げる（呼び出し側でフォールバック）。
     *
     * @param initialMessages system/履歴/user のメッセージ列
     * @param toolSpecs        OpenAI互換の tools 定義（List&lt;Map&gt;）
     * @param toolExecutor     (関数名, 引数JSON) → 実行結果文字列
     */
    public String chatWithTools(LlmConfig config, List<Message> initialMessages, Object toolSpecs,
                                java.util.function.BiFunction<String, String, String> toolExecutor,
                                Integer maxCompletionTokens) {
        validate(config);
        String endpoint = resolveEndpoint(config.baseUrl());
        List<Object> convo = new ArrayList<>(initialMessages);
        String lastContent = "";

        for (int iter = 0; iter < 5; iter++) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", config.model());
            payload.put("messages", convo);
            payload.put("tools", toolSpecs);
            payload.put("tool_choice", "auto");
            if (maxCompletionTokens != null) {
                payload.put("max_completion_tokens", maxCompletionTokens);
            }

            String raw;
            try {
                raw = restClient.post()
                        .uri(endpoint)
                        .header("Authorization", "Bearer " + config.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(payload)
                        .retrieve()
                        .body(String.class);
            } catch (RestClientResponseException e) {
                throw new LlmException(describeHttpError(e, endpoint, config.model()));
            } catch (Exception e) {
                throw new LlmException("LLM APIに接続できませんでした（接続先: " + endpoint + "）: " + e.getMessage());
            }

            JsonNode root;
            try {
                root = objectMapper.readTree(raw);
            } catch (Exception e) {
                throw new LlmException("LLM応答の解析に失敗しました。");
            }
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new LlmException("LLMからのレスポンスが空でした（モデル: " + config.model() + "）。");
            }
            JsonNode message = choices.get(0).path("message");
            JsonNode contentNode = message.path("content");
            String content = (contentNode.isMissingNode() || contentNode.isNull()) ? null : contentNode.asString();
            if (content != null) {
                lastContent = content;
            }

            JsonNode toolCalls = message.path("tool_calls");
            if (toolCalls.isArray() && !toolCalls.isEmpty()) {
                // アシスタントのツール要求メッセージをそのまま会話に追加
                Map<String, Object> assistantMsg = objectMapper.convertValue(
                        message, new tools.jackson.core.type.TypeReference<Map<String, Object>>() {});
                convo.add(assistantMsg);
                // 各ツールを実行し、role=tool の結果メッセージを追加
                for (JsonNode tc : toolCalls) {
                    String id = nodeText(tc.path("id"));
                    String name = nodeText(tc.path("function").path("name"));
                    String args = nodeText(tc.path("function").path("arguments"));
                    String result;
                    try {
                        result = toolExecutor.apply(name, args.isBlank() ? "{}" : args);
                    } catch (Exception ex) {
                        result = "ツール実行エラー: " + ex.getMessage();
                    }
                    Map<String, Object> toolMsg = new LinkedHashMap<>();
                    toolMsg.put("role", "tool");
                    toolMsg.put("tool_call_id", id);
                    toolMsg.put("content", result == null ? "" : result);
                    convo.add(toolMsg);
                }
                continue; // ツール結果を踏まえて再問い合わせ
            }

            // ツール要求が無ければ最終回答
            if (content != null && !content.isBlank()) {
                return content;
            }
            return lastContent;
        }
        return lastContent; // 反復上限に達した場合の保険
    }

    private String nodeText(JsonNode n) {
        return (n == null || n.isMissingNode() || n.isNull()) ? "" : n.asString();
    }

    /**
     * ストリーミングでLLMを呼び出す。差分トークンごとに {@code onChunk} を呼び、最終的な本文全体を返す。
     * OpenAI互換の SSE（{@code data: {...}} 行）を1行ずつ読む。
     */
    public String chatStream(LlmConfig config, List<Message> messages, Integer maxCompletionTokens,
                             Consumer<String> onChunk) {
        return chatStream(config, messages, maxCompletionTokens, onChunk, null);
    }

    /**
     * ストリーミング呼び出し（推論トークン対応）。本文は onChunk、reasoning系モデルの
     * 思考過程（delta.reasoning_content）は onReasoning に流す。onReasoning は null 可。
     */
    public String chatStream(LlmConfig config, List<Message> messages, Integer maxCompletionTokens,
                             Consumer<String> onChunk, Consumer<String> onReasoning) {
        validate(config);
        String endpoint = resolveEndpoint(config.baseUrl());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", config.model());
        payload.put("messages", messages);
        payload.put("stream", true);
        if (maxCompletionTokens != null) {
            payload.put("max_completion_tokens", maxCompletionTokens);
        }

        String body;
        try {
            body = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new LlmException("リクエストの生成に失敗しました: " + e.getMessage());
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(120))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + config.apiKey())
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<Stream<String>> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LlmException("LLM通信が中断されました。");
        } catch (Exception e) {
            throw new LlmException("LLM APIに接続できませんでした（接続先: " + endpoint + "）: " + e.getMessage());
        }

        int status = response.statusCode();
        if (status != 200) {
            String errBody = response.body().limit(50).reduce("", (a, b) -> a + b);
            throw new LlmException(describeStatus(status, errBody, endpoint, config.model()));
        }

        StringBuilder full = new StringBuilder();
        try (Stream<String> lines = response.body()) {
            lines.forEach(line -> {
                if (line == null || line.isBlank()) {
                    return;
                }
                String data = line.startsWith("data:") ? line.substring(5).trim() : line.trim();
                if (data.equals("[DONE]") || !data.startsWith("{")) {
                    return;
                }
                try {
                    JsonNode node = objectMapper.readTree(data);
                    JsonNode choices = node.path("choices");
                    if (choices.isArray() && !choices.isEmpty()) {
                        JsonNode delta = choices.get(0).path("delta");
                        // 推論モデルの思考過程（reasoning_content）を先に流す
                        if (onReasoning != null) {
                            JsonNode rNode = delta.path("reasoning_content");
                            if (!rNode.isMissingNode() && !rNode.isNull()) {
                                String rPiece = rNode.asString();
                                if (rPiece != null && !rPiece.isEmpty()) {
                                    onReasoning.accept(rPiece);
                                }
                            }
                        }
                        JsonNode contentNode = delta.path("content");
                        if (!contentNode.isMissingNode() && !contentNode.isNull()) {
                            String piece = contentNode.asString();
                            if (piece != null && !piece.isEmpty()) {
                                full.append(piece);
                                onChunk.accept(piece);
                            }
                        }
                    }
                } catch (Exception ignore) {
                    // 壊れた行はスキップ
                }
            });
        }

        if (full.length() == 0) {
            throw new LlmException("LLMからの応答が空でした（モデル: " + config.model() + "）。");
        }
        return full.toString();
    }

    private String describeStatus(int status, String body, String endpoint, String model) {
        String trimmedBody = body == null ? "" : body.strip();
        boolean looksLikeHtml = trimmedBody.startsWith("<");
        String hint;
        if (looksLikeHtml || status == 404) {
            hint = "ベースURLがLLM APIのエンドポイントとして正しくない可能性があります。";
        } else if (status == 401 || status == 403) {
            hint = "APIキーが正しいか確認してください。";
        } else if (status == 400 || status == 422) {
            hint = "モデル名（" + model + "）やリクエスト内容がプロバイダで受け付けられませんでした。";
        } else {
            hint = "しばらくしてから再度お試しください。";
        }
        String snippet = looksLikeHtml ? "(HTMLページが返されました)" : snippet(trimmedBody);
        return "LLM APIエラー (HTTP " + status + ")。" + hint + " [接続先: " + endpoint + " / 応答: " + snippet + "]";
    }

    /**
     * HTTPエラー応答を、原因が分かる短いメッセージに整形する。
     * HTMLが返る＝ベースURLがAPIエンドポイントでない、等をヒントとして付ける。
     */
    private String describeHttpError(RestClientResponseException e, String endpoint, String model) {
        int status = e.getStatusCode().value();
        String body = e.getResponseBodyAsString();
        String trimmedBody = body == null ? "" : body.strip();
        boolean looksLikeHtml = trimmedBody.startsWith("<");

        String hint;
        if (looksLikeHtml || status == 404) {
            hint = "ベースURLがLLM APIのエンドポイントとして正しくない可能性があります。"
                    + "設定画面のベースURLを確認してください（例: OpenRouterは https://openrouter.ai/api/v1 、"
                    + "DeepSeekは https://api.deepseek.com 、LM Studioは http://localhost:1234/v1 ）。";
        } else if (status == 401 || status == 403) {
            hint = "APIキーが正しいか確認してください。";
        } else if (status == 400 || status == 422) {
            hint = "モデル名（" + model + "）やリクエスト内容がプロバイダで受け付けられませんでした。";
        } else {
            hint = "しばらくしてから再度お試しください。";
        }

        String snippet = looksLikeHtml ? "(HTMLページが返されました)" : snippet(trimmedBody);
        return "LLM APIエラー (HTTP " + status + ")。" + hint + " [接続先: " + endpoint + " / 応答: " + snippet + "]";
    }

    private String snippet(String s) {
        if (s == null || s.isBlank()) return "(空)";
        String oneLine = s.replaceAll("\\s+", " ").strip();
        return oneLine.length() > 180 ? oneLine.substring(0, 180) + "…" : oneLine;
    }

    /**
     * テキスト + 画像1枚でLLMを呼び出す（Vision）。画像はdata URL(base64)として送信。
     */
    public String chatWithImage(LlmConfig config, String prompt, byte[] imageBytes, String contentType) {
        String mediaType = (contentType != null && contentType.startsWith("image/")) ? contentType : "image/jpeg";
        String dataUrl = "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(imageBytes);

        List<Object> content = new ArrayList<>();
        content.add(new TextPart(prompt));
        content.add(new ImagePart(new ImageUrl(dataUrl)));

        return chat(config, List.of(new Message("user", content)), 2048);
    }

    private void validate(LlmConfig config) {
        if (config == null || isBlank(config.baseUrl()) || isBlank(config.model()) || isBlank(config.apiKey())) {
            throw new IllegalArgumentException("LLMのAPI設定が未登録です。設定画面でベースURL・モデル・APIキーを登録してください。");
        }
    }

    /**
     * ベースURLを chat completions エンドポイントに正規化する。
     * プロバイダによりパスが異なる（OpenRouterは /api/v1 等）ため、ユーザーが
     * 完全なエンドポイントや "/v1" 付きのURLを指定した場合はそれを尊重する。
     *
     *  - ".../chat/completions" で終わる → そのまま使用（フルエンドポイント指定）
     *  - ".../v1" で終わる            → "/chat/completions" を付与（例: https://openrouter.ai/api/v1）
     *  - それ以外                      → "/v1/chat/completions" を付与（例: https://api.openai.com）
     */
    private String resolveEndpoint(String baseUrl) {
        String trimmed = baseUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        if (trimmed.endsWith("/chat/completions")) {
            return trimmed;
        }
        if (trimmed.endsWith("/v1")) {
            return trimmed + "/chat/completions";
        }
        return trimmed + "/v1/chat/completions";
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
