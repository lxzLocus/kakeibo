package com.study.kakeibo.controller;

import tools.jackson.databind.ObjectMapper;
import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.exception.GlobalExceptionHandler;
import com.study.kakeibo.service.CategoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CategoryController.class)
@Import(GlobalExceptionHandler.class)
@WithMockUser
class CategoryControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockitoBean private CategoryService categoryService;

    private User user;
    private Category sampleCategory;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setUsername("テスト");

        sampleCategory = new Category();
        sampleCategory.setId(10L);
        sampleCategory.setUser(user);
        sampleCategory.setName("食費");
        sampleCategory.setCreatedAt(LocalDateTime.now());
    }

    @Test
    @DisplayName("POST /categories — 正常に作成")
    void create_success() throws Exception {
        when(categoryService.addCategory(eq(1L), eq("食費"), any())).thenReturn(sampleCategory);

        String body = """
                { "name": "食費" }
                """;

        mockMvc.perform(post("/categories")
                        .with(csrf())
                        .header("X-User-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryId").value(10))
                .andExpect(jsonPath("$.name").value("食費"));
    }

    @Test
    @DisplayName("POST /categories — 重複名で 400")
    void create_duplicate() throws Exception {
        when(categoryService.addCategory(eq(1L), eq("食費"), any()))
                .thenThrow(new IllegalArgumentException("Category with name '食費' already exists for this user."));

        String body = """
                { "name": "食費" }
                """;

        mockMvc.perform(post("/categories")
                        .with(csrf())
                        .header("X-User-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("already exists")));
    }

    @Test
    @DisplayName("GET /categories — 一覧取得")
    void getAll() throws Exception {
        Category c2 = new Category();
        c2.setId(11L);
        c2.setUser(user);
        c2.setName("交通費");
        c2.setCreatedAt(LocalDateTime.now());

        when(categoryService.getCategoriesByUserId(1L)).thenReturn(List.of(sampleCategory, c2));

        mockMvc.perform(get("/categories")
                        .header("X-User-Id", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].name").value("食費"))
                .andExpect(jsonPath("$[1].name").value("交通費"));
    }

    @Test
    @DisplayName("PUT /categories/{id} — 正常に更新")
    void update_success() throws Exception {
        sampleCategory.setName("外食費");
        when(categoryService.updateCategory(1L, 10L, "外食費")).thenReturn(sampleCategory);

        String body = """
                { "name": "外食費" }
                """;

        mockMvc.perform(put("/categories/10")
                        .with(csrf())
                        .header("X-User-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("外食費"));
    }

    @Test
    @DisplayName("DELETE /categories/{id} — 204 No Content")
    void delete_success() throws Exception {
        doNothing().when(categoryService).deleteCategory(1L, 10L, null);

        mockMvc.perform(delete("/categories/10")
                        .with(csrf())
                        .header("X-User-Id", "1"))
                .andExpect(status().isNoContent());

        verify(categoryService).deleteCategory(1L, 10L, null);
    }
}
