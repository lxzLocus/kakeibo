package com.study.kakeibo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // フロントは /api を同一オリジンでプロキシするが、Next がバックエンドへ転送する際に
    // Origin ヘッダ（例: http://192.168.1.50:3000, http://kakeibo.home）を引き継ぐため、
    // ブラウザから見えるオリジンをここで許可する必要がある。既定はLAN内アクセスのみ。
    // 独自ホスト名で公開する場合は APP_CORS_ALLOWED_ORIGIN_PATTERNS に追加すること。
    private final List<String> allowedOriginPatterns;

    public SecurityConfig(@Value("${app.cors.allowed-origin-patterns}") List<String> allowedOriginPatterns) {
        this.allowedOriginPatterns = allowedOriginPatterns;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // 認証情報付き(allowCredentials=true)でもパターン指定なら利用可能。
        config.setAllowedOriginPatterns(allowedOriginPatterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())  // 開発用にCSRFを無効化
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/users/**").permitAll()       // ユーザー登録・ログイン・LLM設定
                .requestMatchers("/entries/**").permitAll()     // エントリーのCRUD
                .requestMatchers("/categories/**").permitAll()  // カテゴリのCRUD
                .requestMatchers("/stores/**").permitAll()      // 店舗のCRUD
                .requestMatchers("/chats/**").permitAll()       // AIチャット
                .requestMatchers("/goals/**").permitAll()       // 貯蓄目標
                .requestMatchers("/fixed-costs/**").permitAll() // 固定費
                .requestMatchers("/simulation/**").permitAll()  // シミュレーション
                .requestMatchers("/receipts/**").permitAll()    // レシートOCR
                .anyRequest().permitAll()  // 開発用：すべて許可
            )
            .httpBasic(basic -> basic.disable())  // Basic認証を無効化
            .formLogin(form -> form.disable());   // フォームログインを無効化
        
        return http.build();
    }
}
