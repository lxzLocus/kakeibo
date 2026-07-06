package com.study.kakeibo.service;

import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.EntryType;
import java.util.List;

public interface CategoryService {

    // カテゴリの追加（収入/支出 区分つき）
    Category addCategory(Long userId, String name, EntryType type);

    // ユーザーのカテゴリ一覧取得
    List<Category> getCategoriesByUserId(Long userId);

    // カテゴリIDで取得
    Category getCategoryById(Long categoryId);

    // カテゴリの更新
    Category updateCategory(Long userId, Long categoryId, String name);

    // カテゴリの削除
    void deleteCategory(Long userId, Long categoryId);

    // カテゴリ名で存在確認（ユーザースコープ）
    boolean existsUserCategory(Long userId, String name);
}
