package com.study.kakeibo.service.impl;

import com.study.kakeibo.service.CategoryService;
import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.CategoryRepository;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final EntryRepository entryRepository;

    @Autowired
    public CategoryServiceImpl(CategoryRepository categoryRepository, UserRepository userRepository,
                              EntryRepository entryRepository) {
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.entryRepository = entryRepository;
    }

    // カテゴリの追加（収入/支出 区分つき）
    public Category addCategory(Long userId, String name, EntryType type) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        EntryType categoryType = (type != null) ? type : EntryType.EXPENSE;

        // ユーザースコープ内で「同じ区分の同名」が既に存在するか確認（収入/支出で別々に持てる）
        if (categoryRepository.existsByUserAndNameAndType(user, name, categoryType)) {
            throw new IllegalArgumentException("Category with name '" + name + "' already exists for this user.");
        }

        Category newCategory = new Category();
        newCategory.setUser(user);
        newCategory.setName(name);
        newCategory.setType(categoryType);

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
    public Category updateCategory(Long userId, Long categoryId, String name) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("permission error");
        }

        Category existingCategory = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new IllegalArgumentException("permission error"));

        if (!existingCategory.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("permission error");
        }

        existingCategory.setName(name);
        return categoryRepository.save(existingCategory);
    }

    // カテゴリの削除。紐づく取引がある場合は reassignToId のカテゴリへ付け替えてから削除する。
    @Override
    @Transactional
    public void deleteCategory(Long userId, Long categoryId, Long reassignToId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        Category existingCategory = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + categoryId));

        if (!existingCategory.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("You do not have permission to delete this category.");
        }

        long count = entryRepository.countByUserAndCategory(user, existingCategory);
        if (count > 0) {
            if (reassignToId == null) {
                throw new IllegalArgumentException(
                    "このカテゴリには " + count + " 件の取引があります。移動先カテゴリを指定してください。");
            }
            if (reassignToId.equals(categoryId)) {
                throw new IllegalArgumentException("移動先には削除するカテゴリ以外を指定してください。");
            }
            Category target = categoryRepository.findById(reassignToId)
                .orElseThrow(() -> new IllegalArgumentException("移動先カテゴリが見つかりません: " + reassignToId));
            if (!target.getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("移動先カテゴリの権限がありません。");
            }
            if (target.getType() != existingCategory.getType()) {
                throw new IllegalArgumentException("移動先は同じ区分（収入/支出）のカテゴリを指定してください。");
            }
            entryRepository.reassignCategory(existingCategory, target);
        }

        categoryRepository.delete(existingCategory);
    }

    // カテゴリID → 取引件数
    @Override
    @Transactional(readOnly = true)
    public Map<Long, Long> getCategoryUsage(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        Map<Long, Long> usage = new HashMap<>();
        for (Object[] row : entryRepository.countPerCategory(user)) {
            usage.put((Long) row[0], (Long) row[1]);
        }
        return usage;
    }

    // カテゴリ名で存在確認（ユーザースコープ）
    public boolean existsUserCategory(Long userId, String name) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        return categoryRepository.existsByUserAndName(user, name);
    }
}
