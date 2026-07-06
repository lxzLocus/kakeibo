package com.study.kakeibo.service;

import tools.jackson.databind.ObjectMapper;
import com.study.kakeibo.dto.Response.ReceiptDraftDto;
import com.study.kakeibo.entity.LlmPurpose;
import com.study.kakeibo.service.llm.LlmClient;
import com.study.kakeibo.service.llm.LlmConfig;
import com.study.kakeibo.service.llm.PromptLoaderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * レシート画像を「ローカルOCR(Tesseract) → テキストLLMで補正・構造化 → JSON」の流れで処理し、
 * 支出データのドラフトを返す。画像は永続化しない。抽出結果はフロントで確認・編集してから /entries に登録する。
 *
 *   photo → OCR(Tesseract, 手元) → LLM(テキスト補正) → JSON → （フロントで確認）→ DB
 *
 * OCRを手元で行うため、補正用LLMは画像非対応のテキストモデル（例: DeepSeek）でよい。
 */
@Service
public class ReceiptOcrService {

    private static final Logger log = LoggerFactory.getLogger(ReceiptOcrService.class);

    /** Tesseractの言語（日本語＋英語） */
    private static final String OCR_LANG = "jpn+eng";
    private static final long OCR_TIMEOUT_SECONDS = 30;

    private final LlmConfigService llmConfigService;
    private final LlmClient llmClient;
    private final PromptLoaderService promptLoader;
    private final ObjectMapper objectMapper;

    public ReceiptOcrService(LlmConfigService llmConfigService,
                             LlmClient llmClient,
                             PromptLoaderService promptLoader,
                             ObjectMapper objectMapper) {
        this.llmConfigService = llmConfigService;
        this.llmClient = llmClient;
        this.promptLoader = promptLoader;
        this.objectMapper = objectMapper;
    }

    public ReceiptDraftDto scan(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("画像ファイルが空です。");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("画像ファイルを指定してください。");
        }

        // 補正用LLM設定（VISION枠を流用。ローカルOCR後の補正なのでテキストモデルでOK）
        LlmConfig config = llmConfigService.getDecryptedConfig(userId, LlmPurpose.VISION);

        // 1. ローカルOCR（Tesseract）で生テキストを取得
        String ocrText = runOcr(file);
        if (ocrText.isBlank()) {
            throw new IllegalArgumentException("画像から文字を読み取れませんでした。明るく・ピントの合った写真でお試しください。");
        }

        // 2. テキストLLMで補正・構造化（JSON出力）
        String prompt = promptLoader.load("prompts/receipt/correct.md", Map.of("ocrText", ocrText));
        String raw = llmClient.chat(config, List.of(new LlmClient.Message("user", prompt)), 1024);

        // 3. JSON抽出→パース
        String json = extractJson(raw);
        try {
            return objectMapper.readValue(json, ReceiptDraftDto.class);
        } catch (Exception e) {
            throw new RuntimeException("レシートの解析結果を読み取れませんでした。別の画像でお試しください。", e);
        }
    }

    /**
     * Tesseract CLI を呼び出して画像から文字列を抽出する。
     */
    private String runOcr(MultipartFile file) {
        File tmp = null;
        try {
            String ext = extensionOf(file.getContentType());
            tmp = File.createTempFile("receipt-", ext);
            file.transferTo(tmp);

            Process process = new ProcessBuilder(
                    "tesseract", tmp.getAbsolutePath(), "stdout", "-l", OCR_LANG, "--psm", "6")
                    .redirectErrorStream(false)
                    .start();

            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            boolean finished = process.waitFor(OCR_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new RuntimeException("OCR処理がタイムアウトしました。");
            }
            if (process.exitValue() != 0) {
                String err = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
                throw new RuntimeException("OCR処理に失敗しました: " + err);
            }
            return output.trim();
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new RuntimeException("OCR処理中にエラーが発生しました: " + e.getMessage(), e);
        } finally {
            if (tmp != null && !tmp.delete()) {
                tmp.deleteOnExit();
            }
        }
    }

    private String extensionOf(String contentType) {
        if (contentType == null) return ".jpg";
        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
    }

    /**
     * LLM応答からJSON部分を抽出する。コードフェンスや前後の説明文を取り除き、
     * 最初の '{' から波括弧の対応が取れる位置までを切り出す。
     */
    private String extractJson(String text) {
        if (text == null) {
            throw new IllegalArgumentException("空の応答です。");
        }
        String cleaned = text.replace("```json", "").replace("```", "").trim();
        int start = cleaned.indexOf('{');
        if (start < 0) {
            throw new IllegalArgumentException("JSONが見つかりませんでした。");
        }
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int i = start; i < cleaned.length(); i++) {
            char c = cleaned.charAt(i);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                }
                continue;
            }
            if (c == '"') {
                inString = true;
            } else if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0) {
                    return cleaned.substring(start, i + 1);
                }
            }
        }
        // 閉じ括弧が不足している場合は不足分を補う
        StringBuilder sb = new StringBuilder(cleaned.substring(start));
        for (int i = 0; i < depth; i++) {
            sb.append('}');
        }
        return sb.toString();
    }
}
