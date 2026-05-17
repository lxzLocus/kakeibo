package com.study.kakeibo.service;

import com.study.kakeibo.entity.Category;
import java.util.List;

public interface CategoryService {

    // カテゴリの追加
    Category addCategory(Long userId, String name);

    // ユーザーのカテゴリ一覧取得
    List<Category> getCategoriesByUserId(Long userId);

    // カテゴリIDで取得
    Category getCategoryById(Long categoryId);

    // カテゴリの更新
    Category updateCategory(Long categoryId, String name);

    // カテゴリの削除
    void deleteCategory(Long categoryId);

    // カテゴリ名で存在確認（ユーザースコープ）
    boolean existsUserCategory(Long userId, String name);
}
