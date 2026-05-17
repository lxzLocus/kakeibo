package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.Store;

@Repository
public interface EntryRepository extends JpaRepository<Entry, Long> {

    /* Getter */
    // ユーザーに紐づくエントリー一覧を取得
    List<Entry> findByUser(User user);

    // ユーザーと期間で絞り込んだエントリー一覧を取得
    List<Entry> findByUserAndEntryDateBetween(User user, LocalDate startDate, LocalDate endDate);

    // ユーザーとカテゴリで絞り込む
    List<Entry> findByUserAndCategory(User user, Category category);

    // ユーザーと店舗で絞り込む
    List<Entry> findByUserAndStore(User user, Store store);

    // ユーザーとタイプ（収入/支出）で絞り込む
    List<Entry> findByUserAndType(User user, EntryType type);

    // ユーザー、期間、カテゴリで絞り込む
    List<Entry> findByUserAndCategoryAndEntryDateBetween(User user, Category category, LocalDate startDate,
            LocalDate endDate);

    // ユーザー、期間、タイプで絞り込む
    List<Entry> findByUserAndTypeAndEntryDateBetween(User user, EntryType type, LocalDate startDate, LocalDate endDate);
}
