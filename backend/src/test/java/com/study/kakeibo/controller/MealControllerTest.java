package com.study.kakeibo.controller;

import tools.jackson.databind.ObjectMapper;
import com.study.kakeibo.dto.Response.MealItemResponseDto;
import com.study.kakeibo.dto.Response.MealResponseDto;
import com.study.kakeibo.exception.GlobalExceptionHandler;
import com.study.kakeibo.service.MealService;
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
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MealController.class)
@Import(GlobalExceptionHandler.class)
@WithMockUser
class MealControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockitoBean private MealService mealService;

    private MealResponseDto sampleDto() {
        MealItemResponseDto item = new MealItemResponseDto();
        item.setId(1L);
        item.setInventoryId(10L);
        item.setItemName("牛乳");
        item.setQuantityUsed(new BigDecimal("200"));
        item.setEstimatedCost(new BigDecimal("44.00"));

        MealResponseDto dto = new MealResponseDto();
        dto.setId(100L);
        dto.setMealDatetime(LocalDateTime.of(2026, 5, 30, 12, 0));
        dto.setMealType("LUNCH");
        dto.setTitle("シリアル");
        dto.setServings(1);
        dto.setEstimatedTotalCost(new BigDecimal("44.00"));
        dto.setCostPerServing(new BigDecimal("44.00"));
        dto.setItems(List.of(item));
        return dto;
    }

    @Test
    @DisplayName("POST /meals — 正常に作成")
    void create_success() throws Exception {
        when(mealService.create(eq(1L), any())).thenReturn(sampleDto());

        String body = """
                {
                    "mealDatetime": "2026-05-30T12:00:00",
                    "mealType": "LUNCH",
                    "title": "シリアル",
                    "servings": 1,
                    "items": [
                        {"inventoryId": 10, "quantityUsed": 200}
                    ]
                }
                """;

        mockMvc.perform(post("/meals")
                        .with(csrf())
                        .header("X-User-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.title").value("シリアル"))
                .andExpect(jsonPath("$.estimatedTotalCost").value(44.00))
                .andExpect(jsonPath("$.costPerServing").value(44.00))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].itemName").value("牛乳"));
    }

    @Test
    @DisplayName("GET /meals — 期間指定で取得")
    void getAll_dateRange() throws Exception {
        when(mealService.getAll(eq(1L), eq("2026-05-01"), eq("2026-05-31")))
                .thenReturn(List.of(sampleDto()));

        mockMvc.perform(get("/meals")
                        .header("X-User-Id", "1")
                        .param("since", "2026-05-01")
                        .param("until", "2026-05-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("シリアル"));
    }

    @Test
    @DisplayName("GET /meals/{id} — 詳細取得")
    void getById_success() throws Exception {
        when(mealService.getById(1L, 100L)).thenReturn(sampleDto());

        mockMvc.perform(get("/meals/100")
                        .header("X-User-Id", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.items[0].estimatedCost").value(44.00));
    }

    @Test
    @DisplayName("GET /meals/{id} — 存在しない場合 400")
    void getById_notFound() throws Exception {
        when(mealService.getById(1L, 999L))
                .thenThrow(new IllegalArgumentException("Meal not found or permission denied"));

        mockMvc.perform(get("/meals/999")
                        .header("X-User-Id", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Meal not found")));
    }

    @Test
    @DisplayName("DELETE /meals/{id} — 204 No Content")
    void delete_success() throws Exception {
        doNothing().when(mealService).delete(1L, 100L);

        mockMvc.perform(delete("/meals/100")
                        .with(csrf())
                        .header("X-User-Id", "1"))
                .andExpect(status().isNoContent());

        verify(mealService).delete(1L, 100L);
    }

    @Test
    @DisplayName("GET /meals — パラメータ不足で 400")
    void getAll_missingParams() throws Exception {
        mockMvc.perform(get("/meals")
                        .header("X-User-Id", "1"))
                // since, until は required=true
                .andExpect(status().isBadRequest());
    }
}
