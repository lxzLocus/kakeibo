package com.study.kakeibo.repository;

import com.study.kakeibo.entity.FundPool;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FundPoolRepository extends JpaRepository<FundPool, Long> {

    List<FundPool> findByUserIdOrderBySortOrderAscIdAsc(Long userId);

    Optional<FundPool> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);
}
