package com.study.kakeibo.repository;

import com.study.kakeibo.entity.MealItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MealItemRepository extends JpaRepository<MealItem, Long> {

    List<MealItem> findByMealId(Long mealId);
}
