package com.study.kakeibo.repository;

import com.study.kakeibo.entity.ShoppingItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShoppingItemRepository extends JpaRepository<ShoppingItem, Long> {

    List<ShoppingItem> findByUserIdOrderByCreatedAtAscIdAsc(Long userId);

    Optional<ShoppingItem> findByIdAndUserId(Long id, Long userId);
}
