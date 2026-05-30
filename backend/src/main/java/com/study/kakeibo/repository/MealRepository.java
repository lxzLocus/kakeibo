package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Meal;
import com.study.kakeibo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MealRepository extends JpaRepository<Meal, Long> {

    // 期間指定で食事ログを取得
    List<Meal> findByUserAndMealDatetimeBetweenOrderByMealDatetimeDesc(User user, LocalDateTime start, LocalDateTime end);

    // ユーザースコープでID検索
    Optional<Meal> findByIdAndUser(Long id, User user);
}
