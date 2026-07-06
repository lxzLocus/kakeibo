package com.study.kakeibo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;

/**
 * アプリ共通のBean定義。
 * ユーザのLLM APIキーをDBに保存する際の暗号化に使うTextEncryptorを提供する。
 */
@Configuration
public class AppConfig {

    /**
     * AES-256(GCM)によるテキスト暗号化器。
     * password / salt はenv（APP_ENCRYPTION_PASSWORD / APP_ENCRYPTION_SALT）から注入する。
     * salt は16進数文字列であること。
     */
    @Bean
    public TextEncryptor textEncryptor(
            @Value("${app.encryption.password}") String password,
            @Value("${app.encryption.salt}") String salt) {
        return Encryptors.delux(password, salt);
    }
}
