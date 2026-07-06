package com.study.kakeibo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * アップロードされたチャット画像を配信する。
 * 保存先: ./chat-uploads/  → 公開URL: /images/**（フロントは /api/images/** でプロキシ）
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    public static final String UPLOAD_DIR = "./chat-uploads/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/images/**")
                .addResourceLocations("file:" + UPLOAD_DIR);
    }
}
