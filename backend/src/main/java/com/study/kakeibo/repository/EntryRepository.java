package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface EntryRepository extends JpaRepository<Entry, Long> {

    /* Getter */
    // ユーザーに紐づくエントリー一覧を取得
    List<Entry> findByUser(User user);

    // ユーザーと期間で絞り込んだエントリー一覧を取得
    List<Entry> findByUserAndEntryDateBetween(User user, LocalDate startDate, LocalDate endDate);    
}
