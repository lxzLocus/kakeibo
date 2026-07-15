package com.study.kakeibo.service;

import com.study.kakeibo.dto.Response.AnalysisResponseDto;
import com.study.kakeibo.entity.UserEvaluation;
import com.study.kakeibo.repository.UserEvaluationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

/**
 * 「評価バッチ」: ユーザーごとに設定した頻度で、コードベースの分析（LLM不使用）を定期実行し、
 * 結果と最終実行時刻を記録する。手動実行(runNow)と設定変更も提供する。
 */
@Service
public class EvaluationService {

    private static final Logger log = LoggerFactory.getLogger(EvaluationService.class);
    private static final Set<String> VALID = Set.of("OFF", "DAILY", "WEEKLY", "MONTHLY");

    private final UserEvaluationRepository repository;
    private final AnalyticsService analyticsService;
    private final ObjectMapper objectMapper;

    public EvaluationService(UserEvaluationRepository repository,
                             AnalyticsService analyticsService,
                             ObjectMapper objectMapper) {
        this.repository = repository;
        this.analyticsService = analyticsService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public UserEvaluation getOrCreate(Long userId) {
        return repository.findByUserId(userId).orElseGet(() -> {
            UserEvaluation e = new UserEvaluation();
            e.setUserId(userId);
            e.setFrequency("OFF");
            return repository.save(e);
        });
    }

    @Transactional
    public UserEvaluation updateFrequency(Long userId, String frequency) {
        String f = frequency == null ? "OFF" : frequency.trim().toUpperCase();
        if (!VALID.contains(f)) {
            throw new IllegalArgumentException("頻度は OFF / DAILY / WEEKLY / MONTHLY で指定してください。");
        }
        UserEvaluation e = getOrCreate(userId);
        e.setFrequency(f);
        return repository.save(e);
    }

    /** 手動実行: 現在月の分析を計算して結果と最終実行時刻を記録する。 */
    @Transactional
    public UserEvaluation runNow(Long userId) {
        UserEvaluation e = getOrCreate(userId);
        runInto(e, userId);
        return repository.save(e);
    }

    /** 最終実行の代表的な所見（先頭のハイライト）を取り出す。 */
    public String summaryOf(UserEvaluation e) {
        if (e.getResultJson() == null || e.getResultJson().isBlank()) {
            return null;
        }
        try {
            AnalysisResponseDto r = objectMapper.readValue(e.getResultJson(), AnalysisResponseDto.class);
            return (r.getHighlights() != null && !r.getHighlights().isEmpty()) ? r.getHighlights().get(0) : null;
        } catch (Exception ex) {
            return null;
        }
    }

    private void runInto(UserEvaluation e, Long userId) {
        LocalDate today = LocalDate.now();
        AnalysisResponseDto result = analyticsService.analyze(userId, today.getYear(), today.getMonthValue());
        try {
            e.setResultJson(objectMapper.writeValueAsString(result));
        } catch (Exception ex) {
            log.warn("評価結果のシリアライズに失敗: {}", ex.getMessage());
        }
        e.setLastRunAt(LocalDateTime.now());
    }

    /** 1時間おきに、頻度が来ているユーザーの評価バッチを実行する。 */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void runDueBatches() {
        LocalDateTime now = LocalDateTime.now();
        List<UserEvaluation> targets = repository.findByFrequencyNot("OFF");
        for (UserEvaluation e : targets) {
            if (isDue(e, now)) {
                try {
                    runInto(e, e.getUserId());
                    repository.save(e);
                    log.info("評価バッチ実行: userId={}, frequency={}", e.getUserId(), e.getFrequency());
                } catch (Exception ex) {
                    log.warn("評価バッチ失敗: userId={}, {}", e.getUserId(), ex.getMessage());
                }
            }
        }
    }

    private boolean isDue(UserEvaluation e, LocalDateTime now) {
        if ("OFF".equals(e.getFrequency())) {
            return false;
        }
        if (e.getLastRunAt() == null) {
            return true;
        }
        long hours = ChronoUnit.HOURS.between(e.getLastRunAt(), now);
        return switch (e.getFrequency()) {
            case "DAILY" -> hours >= 24;
            case "WEEKLY" -> hours >= 24 * 7;
            case "MONTHLY" -> hours >= 24 * 28;
            default -> false;
        };
    }
}
