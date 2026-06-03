package com.study.kakeibo.service;

import com.study.kakeibo.dto.Request.MealItemRequestDto;
import com.study.kakeibo.dto.Request.MealRequestDto;
import com.study.kakeibo.dto.Response.MealResponseDto;
import com.study.kakeibo.entity.*;
import com.study.kakeibo.repository.InventoryRepository;
import com.study.kakeibo.repository.MealItemRepository;
import com.study.kakeibo.repository.MealRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.impl.MealServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MealServiceImplTest {

    @Mock private MealRepository mealRepository;
    @Mock private MealItemRepository mealItemRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private MealServiceImpl mealService;

    private User user;
    private Inventory milkInventory;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setUsername("テスト");

        milkInventory = new Inventory();
        milkInventory.setId(10L);
        milkInventory.setUser(user);
        milkInventory.setItemName("牛乳");
        milkInventory.setQuantity(new BigDecimal("1000")); // 1000ml
        milkInventory.setPurchasePrice(new BigDecimal("220"));
        milkInventory.setUnit("ml");
    }

    @Test
    @DisplayName("正常: 食材付きの食事を登録し、コストが正しく計算される")
    void create_withItems_costCalculation() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByIdAndUser(10L, user)).thenReturn(Optional.of(milkInventory));
        when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> {
            Meal m = inv.getArgument(0);
            m.setId(100L);
            return m;
        });

        // 牛乳 200ml を使う → (200/1000) * 220 = 44.00
        MealItemRequestDto itemDto = new MealItemRequestDto();
        itemDto.setInventoryId(10L);
        itemDto.setQuantityUsed(new BigDecimal("200"));

        MealRequestDto dto = new MealRequestDto();
        dto.setMealDatetime("2026-05-30T12:00:00");
        dto.setMealType("LUNCH");
        dto.setTitle("シリアル");
        dto.setServings(1);
        dto.setItems(List.of(itemDto));

        MealResponseDto result = mealService.create(1L, dto);

        assertThat(result.getId()).isEqualTo(100L);
        assertThat(result.getTitle()).isEqualTo("シリアル");
        assertThat(result.getEstimatedTotalCost()).isEqualByComparingTo("44.00");
        assertThat(result.getCostPerServing()).isEqualByComparingTo("44.00"); // 1人分
        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getItems().get(0).getItemName()).isEqualTo("牛乳");
    }

    @Test
    @DisplayName("正常: 複数人分の場合 costPerServing が正しい")
    void create_multipleServings() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByIdAndUser(10L, user)).thenReturn(Optional.of(milkInventory));
        when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> {
            Meal m = inv.getArgument(0);
            m.setId(101L);
            return m;
        });

        MealItemRequestDto itemDto = new MealItemRequestDto();
        itemDto.setInventoryId(10L);
        itemDto.setQuantityUsed(new BigDecimal("500")); // (500/1000)*220 = 110

        MealRequestDto dto = new MealRequestDto();
        dto.setMealDatetime("2026-05-30T19:00:00");
        dto.setMealType("DINNER");
        dto.setTitle("シチュー");
        dto.setServings(2); // 2人分
        dto.setItems(List.of(itemDto));

        MealResponseDto result = mealService.create(1L, dto);

        assertThat(result.getEstimatedTotalCost()).isEqualByComparingTo("110.00");
        assertThat(result.getCostPerServing()).isEqualByComparingTo("55.00"); // 110/2
    }

    @Test
    @DisplayName("正常: 食材なしの食事を登録できる")
    void create_noItems() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> {
            Meal m = inv.getArgument(0);
            m.setId(102L);
            return m;
        });

        MealRequestDto dto = new MealRequestDto();
        dto.setMealDatetime("2026-05-30T08:00:00");
        dto.setMealType("BREAKFAST");
        dto.setTitle("外食（記録のみ）");
        dto.setServings(1);
        dto.setItems(null);

        MealResponseDto result = mealService.create(1L, dto);

        assertThat(result.getEstimatedTotalCost()).isEqualByComparingTo("0");
        assertThat(result.getItems()).isEmpty();
    }

    @Test
    @DisplayName("正常: 購入価格がnullの在庫のコストは0")
    void create_noPurchasePrice_costIsZero() {
        Inventory noPriceInv = new Inventory();
        noPriceInv.setId(20L);
        noPriceInv.setUser(user);
        noPriceInv.setItemName("自家製トマト");
        noPriceInv.setQuantity(new BigDecimal("5"));
        noPriceInv.setPurchasePrice(null); // 価格なし

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(inventoryRepository.findByIdAndUser(20L, user)).thenReturn(Optional.of(noPriceInv));
        when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> {
            Meal m = inv.getArgument(0);
            m.setId(103L);
            return m;
        });

        MealItemRequestDto itemDto = new MealItemRequestDto();
        itemDto.setInventoryId(20L);
        itemDto.setQuantityUsed(new BigDecimal("2"));

        MealRequestDto dto = new MealRequestDto();
        dto.setMealDatetime("2026-05-30T12:00:00");
        dto.setMealType("LUNCH");
        dto.setTitle("サラダ");
        dto.setServings(1);
        dto.setItems(List.of(itemDto));

        MealResponseDto result = mealService.create(1L, dto);
        assertThat(result.getEstimatedTotalCost()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("正常: 期間指定で食事一覧を取得")
    void getAll_dateRange() {
        Meal meal = new Meal();
        meal.setId(100L);
        meal.setUser(user);
        meal.setMealDatetime(LocalDateTime.of(2026, 5, 15, 12, 0));
        meal.setMealType(MealType.LUNCH);
        meal.setTitle("ラーメン");
        meal.setServings(1);
        meal.setItems(new ArrayList<>());

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(mealRepository.findByUserAndMealDatetimeBetweenOrderByMealDatetimeDesc(eq(user), any(), any()))
                .thenReturn(List.of(meal));

        List<MealResponseDto> result = mealService.getAll(1L, "2026-05-01", "2026-05-31");
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTitle()).isEqualTo("ラーメン");
    }

    @Test
    @DisplayName("正常: IDで食事を取得できる")
    void getById_success() {
        Meal meal = new Meal();
        meal.setId(100L);
        meal.setUser(user);
        meal.setMealDatetime(LocalDateTime.of(2026, 5, 15, 12, 0));
        meal.setMealType(MealType.LUNCH);
        meal.setTitle("カレー");
        meal.setServings(2);
        meal.setItems(new ArrayList<>());

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(mealRepository.findByIdAndUser(100L, user)).thenReturn(Optional.of(meal));

        MealResponseDto result = mealService.getById(1L, 100L);
        assertThat(result.getTitle()).isEqualTo("カレー");
    }

    @Test
    @DisplayName("異常: 他ユーザーの食事は取得不可")
    void getById_permissionDenied() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(mealRepository.findByIdAndUser(999L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mealService.getById(1L, 999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("permission denied");
    }

    @Test
    @DisplayName("正常: 食事を削除できる")
    void delete_success() {
        Meal meal = new Meal();
        meal.setId(100L);
        meal.setUser(user);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(mealRepository.findByIdAndUser(100L, user)).thenReturn(Optional.of(meal));

        mealService.delete(1L, 100L);
        verify(mealRepository).delete(meal);
    }
}
