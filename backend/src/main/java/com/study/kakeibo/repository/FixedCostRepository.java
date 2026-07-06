package com.study.kakeibo.repository;

import com.study.kakeibo.entity.FixedCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FixedCostRepository extends JpaRepository<FixedCost, Long> {

    List<FixedCost> findByUserIdOrderByIdAsc(Long userId);

    Optional<FixedCost> findByIdAndUserId(Long id, Long userId);
}
