package com.study.kakeibo.repository;

import com.study.kakeibo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /* Getter */
    boolean existsByEmail(String email);
    Optional<User> findByEmail(String email);
    Optional<Long> findUserIdByEmail(String email);
}