package com.study.kakeibo.service;

import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.CategoryRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.impl.CategoryServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryServiceImplTest {

    @Mock private CategoryRepository categoryRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private CategoryServiceImpl categoryService;

    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setUsername("テスト");

        otherUser = new User();
        otherUser.setId(99L);
    }

    @Test
    @DisplayName("正常: カテゴリを追加できる")
    void addCategory_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.existsByUserAndName(user, "食費")).thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            c.setId(10L);
            return c;
        });

        Category result = categoryService.addCategory(1L, "食費");

        assertThat(result.getId()).isEqualTo(10L);
        assertThat(result.getName()).isEqualTo("食費");
        assertThat(result.getUser()).isEqualTo(user);
    }

    @Test
    @DisplayName("異常: 重複カテゴリ名で例外")
    void addCategory_duplicateName() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.existsByUserAndName(user, "食費")).thenReturn(true);

        assertThatThrownBy(() -> categoryService.addCategory(1L, "食費"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    @DisplayName("正常: ユーザーのカテゴリ一覧を取得")
    void getCategoriesByUserId() {
        Category c1 = new Category(); c1.setId(1L); c1.setName("食費");
        Category c2 = new Category(); c2.setId(2L); c2.setName("交通費");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.findByUser(user)).thenReturn(List.of(c1, c2));

        List<Category> result = categoryService.getCategoriesByUserId(1L);
        assertThat(result).hasSize(2);
    }

    @Test
    @DisplayName("正常: カテゴリを更新できる")
    void updateCategory_success() {
        Category existing = new Category();
        existing.setId(10L);
        existing.setUser(user);
        existing.setName("食費");

        when(userRepository.existsById(1L)).thenReturn(true);
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(existing));
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));

        Category result = categoryService.updateCategory(1L, 10L, "外食費");
        assertThat(result.getName()).isEqualTo("外食費");
    }

    @Test
    @DisplayName("異常: 他ユーザーのカテゴリは更新不可")
    void updateCategory_permissionDenied() {
        Category existing = new Category();
        existing.setId(10L);
        existing.setUser(otherUser);

        when(userRepository.existsById(1L)).thenReturn(true);
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> categoryService.updateCategory(1L, 10L, "不正更新"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("permission");
    }

    @Test
    @DisplayName("正常: カテゴリを削除できる")
    void deleteCategory_success() {
        Category existing = new Category();
        existing.setId(10L);
        existing.setUser(user);

        when(categoryRepository.findById(10L)).thenReturn(Optional.of(existing));

        categoryService.deleteCategory(1L, 10L);
        verify(categoryRepository).deleteById(10L);
    }

    @Test
    @DisplayName("異常: 他ユーザーのカテゴリは削除不可")
    void deleteCategory_permissionDenied() {
        Category existing = new Category();
        existing.setId(10L);
        existing.setUser(otherUser);

        when(categoryRepository.findById(10L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> categoryService.deleteCategory(1L, 10L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("permission");
    }
}
