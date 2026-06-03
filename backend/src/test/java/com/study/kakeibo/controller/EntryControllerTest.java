package com.study.kakeibo.controller;

import tools.jackson.databind.ObjectMapper;
import com.study.kakeibo.entity.*;
import com.study.kakeibo.exception.GlobalExceptionHandler;
import com.study.kakeibo.service.EntryService;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(EntryController.class)
@Import(GlobalExceptionHandler.class)
@WithMockUser
class EntryControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockitoBean private EntryService entryService;

    private User user;
    private Category category;
    private Entry sampleEntry;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setUsername("テスト");

        category = new Category();
        category.setId(10L);
        category.setUser(user);
        category.setName("食費");

        sampleEntry = new Entry();
        sampleEntry.setId(100L);
        sampleEntry.setUser(user);
        sampleEntry.setEntryDate(LocalDate.of(2026, 5, 1));
        sampleEntry.setAmount(new BigDecimal("1500"));
        sampleEntry.setCategory(category);
        sampleEntry.setStore(null);
        sampleEntry.setType(EntryType.EXPENSE);
        sampleEntry.setMemo("テスト");
    }

    @Test
    @DisplayName("POST /entries — 正常に作成できる")
    void createEntry_success() throws Exception {
        when(entryService.addEntry(eq(1L), any(), any(), eq(10L), any(), any(), any()))
                .thenReturn(sampleEntry);

        String body = """
                {
                    "entryDate": "2026-05-01",
                    "amount": 1500,
                    "categoryId": 10,
                    "type": "EXPENSE",
                    "memo": "テスト"
                }
                """;

        mockMvc.perform(post("/entries")
                        .with(csrf())
                        .header("X-User-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.amount").value(1500))
                .andExpect(jsonPath("$.type").value("EXPENSE"))
                .andExpect(jsonPath("$.categoryName").value("食費"));
    }

    @Test
    @DisplayName("POST /entries — X-User-Id ヘッダーなしで 400")
    void createEntry_missingHeader() throws Exception {
        String body = """
                {
                    "entryDate": "2026-05-01",
                    "amount": 1500,
                    "categoryId": 10,
                    "type": "EXPENSE"
                }
                """;

        mockMvc.perform(post("/entries")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /entries — 全件取得")
    void getEntries_all() throws Exception {
        when(entryService.getEntryByUserId(1L)).thenReturn(List.of(sampleEntry));

        mockMvc.perform(get("/entries")
                        .header("X-User-Id", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(100));
    }

    @Test
    @DisplayName("GET /entries — 期間指定で取得")
    void getEntries_dateRange() throws Exception {
        when(entryService.getEntryByUserAndDateRange(eq(1L), any(), any()))
                .thenReturn(List.of(sampleEntry));

        mockMvc.perform(get("/entries")
                        .header("X-User-Id", "1")
                        .param("since", "2026-05-01")
                        .param("until", "2026-05-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("PUT /entries/{id} — 正常に更新")
    void updateEntry_success() throws Exception {
        sampleEntry.setMemo("更新済み");
        when(entryService.updateEntry(eq(1L), eq(100L), any(), any(), eq(10L), any(), any(), any()))
                .thenReturn(sampleEntry);

        String body = """
                {
                    "entryDate": "2026-05-01",
                    "amount": 2000,
                    "categoryId": 10,
                    "type": "EXPENSE",
                    "memo": "更新済み"
                }
                """;

        mockMvc.perform(put("/entries/100")
                        .with(csrf())
                        .header("X-User-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memo").value("更新済み"));
    }

    @Test
    @DisplayName("DELETE /entries/{id} — 204 No Content")
    void deleteEntry_success() throws Exception {
        doNothing().when(entryService).deleteEntry(1L, 100L);

        mockMvc.perform(delete("/entries/100")
                        .with(csrf())
                        .header("X-User-Id", "1"))
                .andExpect(status().isNoContent());

        verify(entryService).deleteEntry(1L, 100L);
    }

    @Test
    @DisplayName("POST /entries — ビジネスロジックエラーで 400")
    void createEntry_businessError() throws Exception {
        when(entryService.addEntry(eq(1L), any(), any(), eq(999L), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Category not found with id: 999"));

        String body = """
                {
                    "entryDate": "2026-05-01",
                    "amount": 1500,
                    "categoryId": 999,
                    "type": "EXPENSE"
                }
                """;

        mockMvc.perform(post("/entries")
                        .with(csrf())
                        .header("X-User-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Category not found")));
    }
}
