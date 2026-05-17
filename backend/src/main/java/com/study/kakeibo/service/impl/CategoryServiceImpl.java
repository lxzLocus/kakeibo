package com.study.kakeibo.service.impl;

import com.study.kakeibo.service.CategoryService;
import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.CategoryRepository;
import com.study.kakeibo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;

    @Autowired
    public CategoryServiceImpl(CategoryRepository categoryRepository, UserRepository userRepository) {
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
    }

    // カテゴリの追加
    public Category addCategory(Long userId, String name) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        // ユーザースコープ内で名前が既に存在するか確認
        if (categoryRepository.existsByUserAndName(user, name)) {
            throw new IllegalArgumentException("Category with name '" + name + "' already exists for this user.");
        }

        Category newCategory = new Category();
        newCategory.setUser(user);
        newCategory.setName(name);

        return categoryRepository.save(newCategory);
    }

    // ユーザーのカテゴリ一覧取得
    public List<Category> getCategoriesByUserId(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        return categoryRepository.findByUser(user);
    }

    // カテゴリIDで取得
    public Category getCategoryById(Long categoryId) {
        return categoryRepository.findById(categoryId)
            .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + categoryId));
    }

    // カテゴリの更新
    public Category updateCategory(Long categoryId, String name) {
        Category existingCategory = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + categoryId));

        existingCategory.setName(name);
        return categoryRepository.save(existingCategory);
    }

    // カテゴリの削除
    public void deleteCategory(Long categoryId) {
        if (!categoryRepository.existsById(categoryId)) {
            throw new IllegalArgumentException("Category not found with id: " + categoryId);
        }
        categoryRepository.deleteById(categoryId);
    }

    // カテゴリ名で存在確認（ユーザースコープ）
    public boolean existsUserCategory(Long userId, String name) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        return categoryRepository.existsByUserAndName(user, name);
    }
}
