package com.study.kakeibo.service.llm;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.apache.commons.text.StringSubstitutor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * classpath上のMarkdownプロンプトテンプレートを読み込み、${variable} を置換する。
 * 例: load("prompts/chat/system.md", Map.of("context", "..."))
 */
@Service
public class PromptLoaderService {

    private final ObjectMapper objectMapper;

    public PromptLoaderService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String load(String templatePath, Object data) {
        String template = readTemplate(templatePath);
        return fill(template, data);
    }

    private String readTemplate(String path) {
        try {
            ClassPathResource resource = new ClassPathResource(path);
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("プロンプトテンプレートの読み込みに失敗しました: " + path, e);
        }
    }

    private String fill(String template, Object data) {
        Map<String, Object> valueMap = objectMapper.convertValue(data, new TypeReference<Map<String, Object>>() {
        });
        valueMap.replaceAll((k, v) -> v == null ? "" : v);
        return new StringSubstitutor(valueMap).replace(template);
    }
}
