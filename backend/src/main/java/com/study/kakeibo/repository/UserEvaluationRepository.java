package com.study.kakeibo.repository;

import com.study.kakeibo.entity.UserEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserEvaluationRepository extends JpaRepository<UserEvaluation, Long> {

    Optional<UserEvaluation> findByUserId(Long userId);

    /** スケジューラ用: 実行対象（OFF以外）の設定を取得する。 */
    List<UserEvaluation> findByFrequencyNot(String frequency);
}
