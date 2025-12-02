package com.study.kakeibo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())  // 開発用にCSRFを無効化
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/users/**").permitAll()  // ユーザー登録・ログインを許可
                .requestMatchers("/entries/**").permitAll()  // エントリーのCRUD操作を許可
                .anyRequest().permitAll()  // 開発用：すべて許可
            )
            .httpBasic(basic -> basic.disable())  // Basic認証を無効化
            .formLogin(form -> form.disable());   // フォームログインを無効化
        
        return http.build();
    }
}
