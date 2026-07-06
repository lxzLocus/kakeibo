package com.study.kakeibo.entity;

/**
 * LLM設定の用途。チャットと画像(OCR)で別々のプロバイダ/モデルを使えるようにする。
 * 例: CHAT=DeepSeek(テキスト), VISION=Qwen(画像対応)。
 */
public enum LlmPurpose {
    CHAT,
    VISION
}
