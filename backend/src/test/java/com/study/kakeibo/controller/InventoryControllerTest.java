package com.study.kakeibo.controller;

import tools.jackson.databind.ObjectMapper;
import com.study.kakeibo.dto.Response.InventoryResponseDto;
import com.study.kakeibo.entity.StorageType;
import com.study.kakeibo.exception.GlobalExceptionHandler;
import com.study.kakeibo.service.InventoryService;
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

@WebMvcTest(InventoryController.class)
@Import(GlobalExceptionHandler.class)
@WithMockUser
class InventoryControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockitoBean private InventoryService inventoryService;

    private InventoryResponseDto sampleDto() {
        InventoryResponseDto dto = new InventoryResponseDto();
        dto.setId(10L);
        dto.setItemName("牛乳");
        dto.setQuantity(new BigDecimal("1"));
        dto.setUnit("パック");
        dto.setPurchasePrice(new BigDecimal("220"));
        dto.setPurchaseDate(LocalDate.of(2026, 5, 30));
        dto.setExpiryDate(LocalDate.of(2026, 6, 6));
        dto.setStorage(StorageType.REFRIGERATED);
        dto.setIsConsumed(false);
        dto.setDaysUntilExpiry(5L);
        dto.setCreatedAt(LocalDateTime.now());
        return dto;
    }

    @Test
    @DisplayName("POST /inventory — 正常に作成")
    void create_success() throws Exception {
        when(inventoryService.create(eq(1L), any())).thenReturn(sampleDto());

        String body = """
                {
                    "itemName": "牛乳",
                    "quantity": 1,
                    "unit": "パック",
                    "purchasePrice": 220,
                    "purchaseDate": "2026-05-30",
                    "expiryDate": "2026-06-06",
                    "storage": "REFRIGERATED"
                }
                """;

        mockMvc.perform(post("/inventory")
                        .with(csrf())
                        .header("X-User-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.itemName").value("牛乳"))
                .andExpect(jsonPath("$.storage").value("REFRIGERATED"));
    }

    @Test
    @DisplayName("GET /inventory — 全件取得")
    void getAll_noFilter() throws Exception {
        when(inventoryService.getAll(eq(1L), any())).thenReturn(List.of(sampleDto()));

        mockMvc.perform(get("/inventory")
                        .header("X-User-Id", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].itemName").value("牛乳"));
    }

    @Test
    @DisplayName("GET /inventory?storage=FROZEN — フィルタ取得")
    void getAll_withFilter() throws Exception {
        when(inventoryService.getAll(1L, "FROZEN")).thenReturn(List.of());

        mockMvc.perform(get("/inventory")
                        .header("X-User-Id", "1")
                        .param("storage", "FROZEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("GET /inventory/expiring — 期限間近")
    void getExpiring() throws Exception {
        when(inventoryService.getExpiringSoon(1L, 3)).thenReturn(List.of(sampleDto()));

        mockMvc.perform(get("/inventory/expiring")
                        .header("X-User-Id", "1")
                        .param("days", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("PUT /inventory/{id}/consume — 使い切り")
    void consume_success() throws Exception {
        InventoryResponseDto consumed = sampleDto();
        consumed.setIsConsumed(true);
        when(inventoryService.consume(1L, 10L)).thenReturn(consumed);

        mockMvc.perform(put("/inventory/10/consume")
                        .with(csrf())
                        .header("X-User-Id", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isConsumed").value(true));
    }

    @Test
    @DisplayName("DELETE /inventory/{id} — 204 No Content")
    void delete_success() throws Exception {
        doNothing().when(inventoryService).delete(1L, 10L);

        mockMvc.perform(delete("/inventory/10")
                        .with(csrf())
                        .header("X-User-Id", "1"))
                .andExpect(status().isNoContent());

        verify(inventoryService).delete(1L, 10L);
    }
}
