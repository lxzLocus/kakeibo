package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Category;
import org.springframework.stereotype.Repository;
import com.study.kakeibo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    /* Getter */
    boolean existsByName(String name);

    Optional<Category> findByName(String name);

    Optional<Long> findCategoryIdByName(String name);

    /* User-scoped Getter */
    boolean existsByUserAndName(User user, String name);

    Optional<Category> findByUserAndName(User user, String name);

    Optional<Long> findCategoryIdByUserAndName(User user, String name);

    // ユーザーの全カテゴリを取得
    List<Category> findByUser(User user);
}
