package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Goal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GoalRepository extends JpaRepository<Goal, Long> {

    Optional<Goal> findByUserId(Long userId);

    void deleteByUserId(Long userId);
}
