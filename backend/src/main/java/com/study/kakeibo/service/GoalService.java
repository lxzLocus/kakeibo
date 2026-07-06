package com.study.kakeibo.service;

import com.study.kakeibo.entity.Goal;
import com.study.kakeibo.repository.GoalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

@Service
public class GoalService {

    private final GoalRepository goalRepository;

    public GoalService(GoalRepository goalRepository) {
        this.goalRepository = goalRepository;
    }

    @Transactional(readOnly = true)
    public Optional<Goal> getGoal(Long userId) {
        return goalRepository.findByUserId(userId);
    }

    @Transactional
    public Goal upsert(Long userId, String targetName, BigDecimal targetAmount,
                       LocalDate targetDate, BigDecimal currentSavings) {
        if (targetName == null || targetName.isBlank()) {
            throw new IllegalArgumentException("目標名を入力してください。");
        }
        if (targetAmount == null || targetAmount.signum() <= 0) {
            throw new IllegalArgumentException("目標金額は正の数で入力してください。");
        }
        if (targetDate == null) {
            throw new IllegalArgumentException("目標日を入力してください。");
        }

        Goal goal = goalRepository.findByUserId(userId).orElseGet(Goal::new);
        goal.setUserId(userId);
        goal.setTargetName(targetName.trim());
        goal.setTargetAmount(targetAmount);
        goal.setTargetDate(targetDate);
        goal.setCurrentSavings(currentSavings != null ? currentSavings : BigDecimal.ZERO);
        return goalRepository.save(goal);
    }

    @Transactional
    public void delete(Long userId) {
        goalRepository.deleteByUserId(userId);
    }
}
