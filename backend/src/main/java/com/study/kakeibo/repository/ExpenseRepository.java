package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Expense;
import com.study.kakeibo.entity.Store;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    // ユーザーの月別支出取得（分析で使う）
    List<Expense> findByUserIdAndDateBetween(
        Long userId, 
        LocalDate startDate, 
        LocalDate endDate
    );
    
    // ユーザーの全支出
    List<Expense> findByUserId(Long userId);
    
    // 店舗別集計用
    List<Expense> findByUserIdAndStore(Long userId, Store store);
}