package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.study.kakeibo.entity.User;
import java.util.Optional;
import java.util.List;

@Repository
public interface StoreRepository extends JpaRepository<Store, Long> {

    /* Getter */
    boolean existsByName(String name);

    Optional<Store> findByName(String name);

    Optional<Long> findStoreIdByName(String name);

    /* User-scoped Getter */
    boolean existsByUserAndName(User user, String name);

    Optional<Store> findByUserAndName(User user, String name);

    Optional<Long> findStoreIdByUserAndName(User user, String name);

    // ユーザーの全店舗を取得
    List<Store> findByUser(User user);
}
