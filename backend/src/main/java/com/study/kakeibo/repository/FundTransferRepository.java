package com.study.kakeibo.repository;

import com.study.kakeibo.entity.FundTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FundTransferRepository extends JpaRepository<FundTransfer, Long> {

    List<FundTransfer> findByUserId(Long userId);

    List<FundTransfer> findByUserIdOrderByTransferDateDescIdDesc(Long userId);

    Optional<FundTransfer> findByIdAndUserId(Long id, Long userId);

    /** プール削除時: そのプールが振替元/振替先の振替をすべて削除する（明示クエリで確実に消す）。 */
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM FundTransfer t WHERE t.fromPoolId = :poolId OR t.toPoolId = :poolId")
    void deleteByPool(@Param("poolId") Long poolId);

    /** カード自動引き落としの二重生成防止（同じカード・同じ引き落とし日の振替が既にあるか）。 */
    boolean existsByAutoCardIdAndTransferDate(Long autoCardId, java.time.LocalDate transferDate);
}
