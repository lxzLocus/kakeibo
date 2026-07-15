package com.study.kakeibo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class KakeiboApplication {

	@PostConstruct
	public void init() {
		// アプリケーション全体のタイムゾーンをJSTに設定
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
	}

	public static void main(String[] args) {
		SpringApplication.run(KakeiboApplication.class, args);
	}

}
