package com.study.kakeibo.service;

import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.EntryType;
import java.util.List;
import java.util.Map;

public interface CategoryService {

    // カテゴリの追加（収入/支出 区分つき）
    Category addCategory(Long userId, String name, EntryType type);

    // ユーザーのカテゴリ一覧取得
    List<Category> getCategoriesByUserId(Long userId);

    // カテゴリIDで取得
    Category getCategoryById(Long categoryId);

    // カテゴリの更新
    Category updateCategory(Long userId, Long categoryId, String name);

    // カテゴリの削除。紐づく取引がある場合は reassignToId のカテゴリへ付け替えてから削除する。
    void deleteCategory(Long userId, Long categoryId, Long reassignToId);

    // カテゴリID → 取引件数
    Map<Long, Long> getCategoryUsage(Long userId);

    // カテゴリ名で存在確認（ユーザースコープ）
    boolean existsUserCategory(Long userId, String name);
}
