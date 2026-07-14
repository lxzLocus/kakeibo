package com.study.kakeibo.repository;

import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.Store;

@Repository
public interface EntryRepository extends JpaRepository<Entry, Long> {

    /** 資金プール(口座)ごと・収支タイプごとの合計金額。[fundPoolId(nullable), type, sum] */
    @Query("SELECT e.fundPoolId, e.type, SUM(e.amount) FROM Entry e WHERE e.user = :user GROUP BY e.fundPoolId, e.type")
    List<Object[]> sumByPoolAndType(@Param("user") User user);

    /** プール削除時: そのプールに紐づく収支を主口座(null)へ戻す。 */
    @Modifying
    @Query("UPDATE Entry e SET e.fundPoolId = null WHERE e.fundPoolId = :poolId")
    void clearFundPool(@Param("poolId") Long poolId);

    /* Getter */
    // ユーザーに紐づくエントリー一覧を取得
    List<Entry> findByUser(User user);

    // ユーザーと期間で絞り込んだエントリー一覧を取得
    List<Entry> findByUserAndEntryDateBetween(User user, LocalDate startDate, LocalDate endDate);

    // ユーザーとカテゴリで絞り込む
    List<Entry> findByUserAndCategory(User user, Category category);

    // カテゴリに紐づく取引件数
    long countByUserAndCategory(User user, Category category);

    /** カテゴリ削除時: そのカテゴリの取引を別カテゴリへ付け替える。 */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Entry e SET e.category = :to WHERE e.category = :from")
    void reassignCategory(@Param("from") Category from, @Param("to") Category to);

    /** カテゴリID → 取引件数（設定のカテゴリ管理で使用）。[categoryId, count] */
    @Query("SELECT e.category.id, COUNT(e) FROM Entry e WHERE e.user = :user GROUP BY e.category.id")
    List<Object[]> countPerCategory(@Param("user") User user);

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
