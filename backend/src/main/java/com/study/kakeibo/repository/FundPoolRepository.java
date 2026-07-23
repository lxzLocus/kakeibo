package com.study.kakeibo.repository;

import com.study.kakeibo.entity.FundPool;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FundPoolRepository extends JpaRepository<FundPool, Long> {

    List<FundPool> findByUserIdOrderBySortOrderAscIdAsc(Long userId);

    Optional<FundPool> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);

    /**
     * 引き落とし元プールが削除されたとき、それを参照していたカードの引き落とし設定を解除する
     * （宙に浮いた settlement_pool_id を残さない・壊れた自動引き落としを止める）。
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE FundPool p SET p.settlementPoolId = null, p.autoSettle = false WHERE p.settlementPoolId = :poolId")
    void clearSettlementSource(@Param("poolId") Long poolId);
}
