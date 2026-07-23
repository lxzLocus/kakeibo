package com.study.kakeibo.repository;

import com.study.kakeibo.entity.FixedCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FixedCostRepository extends JpaRepository<FixedCost, Long> {

    List<FixedCost> findByUserIdOrderByIdAsc(Long userId);

    Optional<FixedCost> findByIdAndUserId(Long id, Long userId);

    /** 支払い元プール（口座/カード）が削除されたとき、その固定費を主口座払いに戻す。 */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE FixedCost f SET f.paymentPoolId = null WHERE f.paymentPoolId = :poolId")
    void clearPaymentPool(@Param("poolId") Long poolId);

    /** 記帳先カテゴリが削除されたとき、その参照を外す（記帳時に「固定費」カテゴリへフォールバック）。 */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE FixedCost f SET f.categoryId = null WHERE f.categoryId = :categoryId")
    void clearCategory(@Param("categoryId") Long categoryId);
}
