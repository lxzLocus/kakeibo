package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface StoreRepository extends JpaRepository<Store, Long> {

    /* Getter */
    boolean existsByName(String name);
    Optional<Store> findByName(String name);
    Optional<Long> findStoreIdByName(String name);
    
}
