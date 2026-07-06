package com.study.kakeibo.service;

import com.study.kakeibo.entity.LlmPurpose;
import com.study.kakeibo.entity.UserLlmConfig;
import com.study.kakeibo.repository.UserLlmConfigRepository;
import com.study.kakeibo.service.llm.LlmConfig;
import org.springframework.security.crypto.encrypt.TextEncryptor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * ユーザのLLM接続設定（base_url / model / api_key）の保存・取得を行う。
 * 用途(purpose: CHAT / VISION)ごとに別プロバイダを設定できる。
 * APIキーは {@link TextEncryptor} で暗号化してDBに保存し、利用時のみ復号する。
 */
@Service
public class LlmConfigService {

    private final UserLlmConfigRepository repository;
    private final TextEncryptor textEncryptor;

    public LlmConfigService(UserLlmConfigRepository repository, TextEncryptor textEncryptor) {
        this.repository = repository;
        this.textEncryptor = textEncryptor;
    }

    /**
     * 設定を登録/更新する（APIキーは暗号化保存）。
     */
    @Transactional
    public void upsert(Long userId, LlmPurpose purpose, String baseUrl, String model, String rawApiKey,
                       boolean supportsVision) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("ベースURLを入力してください。");
        }
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException("モデル名を入力してください。");
        }

        UserLlmConfig config = repository.findByUserIdAndPurpose(userId, purpose).orElseGet(UserLlmConfig::new);
        config.setUserId(userId);
        config.setPurpose(purpose);
        config.setBaseUrl(baseUrl.trim());
        config.setModel(model.trim());
        config.setSupportsVision(supportsVision);

        // APIキーが空の場合（既存更新時）は既存キーを維持する
        if (rawApiKey != null && !rawApiKey.isBlank()) {
            config.setApiKeyEnc(textEncryptor.encrypt(rawApiKey.trim()));
        } else if (config.getApiKeyEnc() == null) {
            throw new IllegalArgumentException("APIキーを入力してください。");
        }

        repository.save(config);
    }

    /**
     * LLM呼び出し用の復号済み設定を取得する。未登録なら例外（用途別メッセージ）。
     */
    @Transactional(readOnly = true)
    public LlmConfig getDecryptedConfig(Long userId, LlmPurpose purpose) {
        UserLlmConfig config = repository.findByUserIdAndPurpose(userId, purpose)
                .orElseThrow(() -> new IllegalArgumentException(notConfiguredMessage(purpose)));
        String rawKey = textEncryptor.decrypt(config.getApiKeyEnc());
        return new LlmConfig(config.getBaseUrl(), config.getModel(), rawKey, config.isSupportsVision());
    }

    /**
     * 画面表示用（生キーは返さずマスクする）。
     */
    @Transactional(readOnly = true)
    public Optional<MaskedConfig> getMasked(Long userId, LlmPurpose purpose) {
        return repository.findByUserIdAndPurpose(userId, purpose).map(config -> {
            String rawKey = textEncryptor.decrypt(config.getApiKeyEnc());
            return new MaskedConfig(config.getBaseUrl(), config.getModel(), true, mask(rawKey), config.isSupportsVision());
        });
    }

    @Transactional
    public void delete(Long userId, LlmPurpose purpose) {
        repository.deleteByUserIdAndPurpose(userId, purpose);
    }

    private String notConfiguredMessage(LlmPurpose purpose) {
        String label = purpose == LlmPurpose.VISION ? "画像・OCR用" : "チャット用";
        return label + "のLLM API設定が未登録です。設定画面でベースURL・モデル・APIキーを登録してください。";
    }

    private String mask(String key) {
        if (key == null || key.length() <= 4) {
            return "****";
        }
        return "****" + key.substring(key.length() - 4);
    }

    /** 画面表示用のマスク済み設定 */
    public record MaskedConfig(String baseUrl, String model, boolean hasKey, String maskedKey, boolean supportsVision) {
    }
}
