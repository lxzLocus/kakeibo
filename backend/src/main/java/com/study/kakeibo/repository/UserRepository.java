package com.study.kakeibo.repository;

import com.study.kakeibo.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * ユーザー行を排他ロックして取得する。
     * 「プールが無ければ主口座を自動作成」の処理を同一ユーザーで直列化し、
     * 並行リクエストによる主口座の二重作成を防ぐために使う。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> lockById(@Param("id") Long id);

    /* Getter */
    boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);

    Optional<Long> findUserIdByEmail(String email);

    // ユーザー名で検索
    boolean existsByUsername(String username);

    Optional<User> findByUsername(String username);

}