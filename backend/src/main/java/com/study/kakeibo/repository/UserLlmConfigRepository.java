package com.study.kakeibo.repository;

import com.study.kakeibo.entity.LlmPurpose;
import com.study.kakeibo.entity.UserLlmConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserLlmConfigRepository extends JpaRepository<UserLlmConfig, Long> {

    Optional<UserLlmConfig> findByUserIdAndPurpose(Long userId, LlmPurpose purpose);

    void deleteByUserIdAndPurpose(Long userId, LlmPurpose purpose);
}
