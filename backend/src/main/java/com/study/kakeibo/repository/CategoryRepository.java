package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Category;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    
    /* Getter */
    boolean existsByName(String name);
    Optional<Category> findByName(String name);
    Optional<Long> findCategoryIdByName(String name);
}
