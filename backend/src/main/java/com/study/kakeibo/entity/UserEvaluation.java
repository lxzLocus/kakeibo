package com.study.kakeibo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * ユーザーごとの「評価バッチ」設定と最終実行結果。
 * frequency の頻度で、コードベースの分析を定期実行して結果(resultJson)と最終実行時刻(lastRunAt)を記録する。
 */
@Entity
@Table(name = "user_evaluation")
@Getter
@Setter
public class UserEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /** 実行頻度: OFF / DAILY / WEEKLY / MONTHLY。 */
    @Column(nullable = false, length = 16)
    private String frequency = "OFF";

    /** 最終実行時刻（未実行なら null）。 */
    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    /** 最終実行時の分析結果（JSON）。 */
    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
