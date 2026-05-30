package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Inventory;
import com.study.kakeibo.entity.StorageType;
import com.study.kakeibo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    // ユーザーの未消費在庫を取得
    List<Inventory> findByUserAndIsConsumedFalseOrderByExpiryDateAsc(User user);

    // ユーザーの全在庫を取得（消費済み含む）
    List<Inventory> findByUserOrderByCreatedAtDesc(User user);

    // 保管場所でフィルタ（未消費のみ）
    List<Inventory> findByUserAndStorageAndIsConsumedFalseOrderByExpiryDateAsc(User user, StorageType storage);

    // 期限間近の食材（未消費のみ）
    List<Inventory> findByUserAndIsConsumedFalseAndExpiryDateBeforeOrderByExpiryDateAsc(User user, LocalDate date);

    // ユーザースコープでID検索
    Optional<Inventory> findByIdAndUser(Long id, User user);
}
