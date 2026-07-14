package com.study.kakeibo.repository;

import com.study.kakeibo.entity.FundTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FundTransferRepository extends JpaRepository<FundTransfer, Long> {

    List<FundTransfer> findByUserId(Long userId);

    List<FundTransfer> findByUserIdOrderByTransferDateDescIdDesc(Long userId);

    Optional<FundTransfer> findByIdAndUserId(Long id, Long userId);

    void deleteByFromPoolIdOrToPoolId(Long fromPoolId, Long toPoolId);
}
