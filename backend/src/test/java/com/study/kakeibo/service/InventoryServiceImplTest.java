package com.study.kakeibo.service;

import com.study.kakeibo.dto.Request.InventoryRequestDto;
import com.study.kakeibo.dto.Response.InventoryResponseDto;
import com.study.kakeibo.entity.Inventory;
import com.study.kakeibo.entity.StorageType;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.InventoryRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.impl.InventoryServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryServiceImplTest {

    @Mock private InventoryRepository inventoryRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private InventoryServiceImpl inventoryService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setUsername("テスト");
    }

    private Inventory createInventory(Long id, String name, BigDecimal qty, StorageType storage) {
        Inventory inv = new Inventory();
        inv.setId(id);
        inv.setUser(user);
        inv.setItemName(name);
        inv.setQuantity(qty);
        inv.setUnit("個");
        inv.setPurchasePrice(new BigDecimal("200"));
        inv.setPurchaseDate(LocalDate.of(2026, 5, 1));
        inv.setExpiryDate(LocalDate.now().plusDays(5));
        inv.setStorage(storage);
        inv.setIsConsumed(false);
        inv.setCreatedAt(LocalDateTime.now());
        return inv;
    }

    @Test
    @DisplayName("正常: 在庫を作成できる")
    void create_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(inv -> {
            Inventory i = inv.getArgument(0);
            i.setId(10L);
            i.setCreatedAt(LocalDateTime.now());
            return i;
        });

        InventoryRequestDto dto = new InventoryRequestDto();
        dto.setItemName("牛乳");
        dto.setQuantity(new BigDecimal("1"));
        dto.setUnit("パック");
        dto.setPurchasePrice(new BigDecimal("220"));
        dto.setPurchaseDate("2026-05-30");
        dto.setExpiryDate("2026-06-06");
        dto.setStorage("REFRIGERATED");

        InventoryResponseDto result = inventoryService.create(1L, dto);

        assertThat(result.getId()).isEqualTo(10L);
        assertThat(result.getItemName()).isEqualTo("牛乳");
        assertThat(result.getStorage()).isEqualTo(StorageType.REFRIGERATED);
    }

    @Test
    @DisplayName("正常: storage省略時はREFRIGERATEDがデフォルト")
    void create_defaultStorage() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(inv -> {
            Inventory i = inv.getArgument(0);
            i.setId(11L);
            i.setCreatedAt(LocalDateTime.now());
            return i;
        });

        InventoryRequestDto dto = new InventoryRequestDto();
        dto.setItemName("豆腐");
        dto.setQuantity(new BigDecimal("1"));
        // storage, unit を省略

        InventoryResponseDto result = inventoryService.create(1L, dto);
        assertThat(result.getStorage()).isEqualTo(StorageType.REFRIGERATED);
        assertThat(result.getUnit()).isEqualTo("個"); // デフォルト
    }

    @Test
    @DisplayName("正常: フィルタなしで全在庫を取得")
    void getAll_noFilter() {
        Inventory inv1 = createInventory(1L, "牛乳", BigDecimal.ONE, StorageType.REFRIGERATED);
        Inventory inv2 = createInventory(2L, "冷凍肉", BigDecimal.ONE, StorageType.FROZEN);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByUserAndIsConsumedFalseOrderByExpiryDateAsc(user))
                .thenReturn(List.of(inv1, inv2));

        List<InventoryResponseDto> result = inventoryService.getAll(1L, null);
        assertThat(result).hasSize(2);
    }

    @Test
    @DisplayName("正常: 保管場所でフィルタ")
    void getAll_withStorageFilter() {
        Inventory inv1 = createInventory(1L, "冷凍肉", BigDecimal.ONE, StorageType.FROZEN);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByUserAndStorageAndIsConsumedFalseOrderByExpiryDateAsc(user, StorageType.FROZEN))
                .thenReturn(List.of(inv1));

        List<InventoryResponseDto> result = inventoryService.getAll(1L, "FROZEN");
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStorage()).isEqualTo(StorageType.FROZEN);
    }

    @Test
    @DisplayName("正常: 消費済みにできる")
    void consume_success() {
        Inventory inv = createInventory(10L, "牛乳", BigDecimal.ONE, StorageType.REFRIGERATED);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByIdAndUser(10L, user)).thenReturn(Optional.of(inv));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        InventoryResponseDto result = inventoryService.consume(1L, 10L);
        assertThat(result.getIsConsumed()).isTrue();
    }

    @Test
    @DisplayName("異常: 存在しない在庫の更新は例外")
    void update_notFound() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByIdAndUser(999L, user)).thenReturn(Optional.empty());

        InventoryRequestDto dto = new InventoryRequestDto();
        dto.setItemName("存在しない");
        dto.setQuantity(BigDecimal.ONE);

        assertThatThrownBy(() -> inventoryService.update(1L, 999L, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("permission denied");
    }

    @Test
    @DisplayName("正常: 在庫を削除できる")
    void delete_success() {
        Inventory inv = createInventory(10L, "牛乳", BigDecimal.ONE, StorageType.REFRIGERATED);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByIdAndUser(10L, user)).thenReturn(Optional.of(inv));

        inventoryService.delete(1L, 10L);
        verify(inventoryRepository).delete(inv);
    }

    @Test
    @DisplayName("正常: daysUntilExpiry が正しく計算される")
    void mapEntityToDto_daysUntilExpiry() {
        Inventory inv = createInventory(1L, "牛乳", BigDecimal.ONE, StorageType.REFRIGERATED);
        inv.setExpiryDate(LocalDate.now().plusDays(3));

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByUserAndIsConsumedFalseOrderByExpiryDateAsc(user))
                .thenReturn(List.of(inv));

        List<InventoryResponseDto> result = inventoryService.getAll(1L, null);
        assertThat(result.get(0).getDaysUntilExpiry()).isEqualTo(3L);
    }
}
