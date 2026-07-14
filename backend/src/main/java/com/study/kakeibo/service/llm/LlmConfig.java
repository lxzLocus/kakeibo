package com.study.kakeibo.service.llm;

/**
 * 1回のLLM呼び出しに必要な接続情報。
 * グローバル環境変数ではなく、ユーザごとにDBへ保存した設定を復号して渡す。
 *
 * @param baseUrl OpenAI互換のベースURL（例: https://api.openai.com もしくは http://localhost:1234）
 * @param model   モデル名（例: gpt-4o-mini）
 * @param apiKey  APIキー（復号済みの生キー）
 */
public record LlmConfig(String baseUrl, String model, String apiKey, boolean supportsVision, boolean directOcr) {

    /**
     * ログにAPIキーが平文で出力されないようにマスクする。
     * （LoggingAspect がメソッド戻り値/引数を toString でログ出力するため）
     */
    @Override
    public String toString() {
        return "LlmConfig[baseUrl=" + baseUrl + ", model=" + model + ", apiKey=***REDACTED***, supportsVision="
                + supportsVision + ", directOcr=" + directOcr + "]";
    }
}

