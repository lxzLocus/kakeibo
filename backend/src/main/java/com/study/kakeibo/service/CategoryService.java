package com.study.kakeibo.service;

import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.EntryType;
import java.util.List;
import java.util.Map;

public interface CategoryService {

    // カテゴリの追加（収入/支出 区分つき）
    Category addCategory(Long userId, String name, EntryType type);

    // カテゴリの追加（グループ付き）
    Category addCategory(Long userId, String name, EntryType type, String groupName);

    // ユーザーのカテゴリ一覧取得
    List<Category> getCategoriesByUserId(Long userId);

    // カテゴリIDで取得
    Category getCategoryById(Long categoryId);

    // カテゴリの更新（名前のみ。グループは変更しない）
    Category updateCategory(Long userId, Long categoryId, String name);

    // カテゴリのグループ（プライマリ）を設定する。null/空は未分類。
    Category setCategoryGroup(Long userId, Long categoryId, String groupName);

    // カテゴリの削除。紐づく取引がある場合は reassignToId のカテゴリへ付け替えてから削除する。
    void deleteCategory(Long userId, Long categoryId, Long reassignToId);

    // カテゴリID → 取引件数
    Map<Long, Long> getCategoryUsage(Long userId);

    // カテゴリの並び替え（指定ID順に表示順を振り直す）
    void reorderCategories(Long userId, List<Long> orderedIds);

    // カテゴリ名で存在確認（ユーザースコープ）
    boolean existsUserCategory(Long userId, String name);
}
