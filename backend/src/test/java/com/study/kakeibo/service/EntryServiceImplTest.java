package com.study.kakeibo.service;

import com.study.kakeibo.entity.*;
import com.study.kakeibo.repository.*;
import com.study.kakeibo.service.impl.EntryServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EntryServiceImplTest {

    @Mock private EntryRepository entryRepository;
    @Mock private UserRepository userRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private StoreRepository storeRepository;

    @InjectMocks private EntryServiceImpl entryService;

    private User user;
    private User otherUser;
    private Category category;
    private Store store;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setUsername("テストユーザー");

        otherUser = new User();
        otherUser.setId(99L);
        otherUser.setUsername("他人");

        category = new Category();
        category.setId(10L);
        category.setUser(user);
        category.setName("食費");

        store = new Store();
        store.setId(20L);
        store.setUser(user);
        store.setName("ライフ");
    }

    @Test
    @DisplayName("正常: エントリーを登録できる")
    void addEntry_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(category));
        when(storeRepository.findById(20L)).thenReturn(Optional.of(store));
        when(entryRepository.save(any(Entry.class))).thenAnswer(inv -> {
            Entry e = inv.getArgument(0);
            e.setId(100L);
            return e;
        });

        Entry result = entryService.addEntry(1L, LocalDate.of(2026, 5, 1),
                new BigDecimal("1500"), 10L, 20L, EntryType.EXPENSE, "テストメモ", null, null);

        assertThat(result.getId()).isEqualTo(100L);
        assertThat(result.getAmount()).isEqualByComparingTo("1500");
        assertThat(result.getType()).isEqualTo(EntryType.EXPENSE);
        assertThat(result.getMemo()).isEqualTo("テストメモ");
        verify(entryRepository).save(any(Entry.class));
    }

    @Test
    @DisplayName("正常: Store なしでも登録できる")
    void addEntry_withoutStore() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(category));
        when(entryRepository.save(any(Entry.class))).thenAnswer(inv -> inv.getArgument(0));

        Entry result = entryService.addEntry(1L, LocalDate.of(2026, 5, 1),
                new BigDecimal("500"), 10L, null, EntryType.INCOME, null, null, null);

        assertThat(result.getStore()).isNull();
        assertThat(result.getType()).isEqualTo(EntryType.INCOME);
    }

    @Test
    @DisplayName("異常: 存在しないユーザーで例外")
    void addEntry_userNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                entryService.addEntry(999L, LocalDate.now(), BigDecimal.TEN, 10L, null, EntryType.EXPENSE, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    @DisplayName("異常: 他ユーザーのカテゴリは使用不可")
    void addEntry_categoryBelongsToOtherUser() {
        Category otherCategory = new Category();
        otherCategory.setId(10L);
        otherCategory.setUser(otherUser);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(otherCategory));

        assertThatThrownBy(() ->
                entryService.addEntry(1L, LocalDate.now(), BigDecimal.TEN, 10L, null, EntryType.EXPENSE, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Category does not belong");
    }

    @Test
    @DisplayName("異常: 他ユーザーの店舗は使用不可")
    void addEntry_storeBelongsToOtherUser() {
        Store otherStore = new Store();
        otherStore.setId(20L);
        otherStore.setUser(otherUser);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(category));
        when(storeRepository.findById(20L)).thenReturn(Optional.of(otherStore));

        assertThatThrownBy(() ->
                entryService.addEntry(1L, LocalDate.now(), BigDecimal.TEN, 10L, 20L, EntryType.EXPENSE, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Store does not belong");
    }

    @Test
    @DisplayName("正常: 期間指定でエントリー取得")
    void getEntryByUserAndDateRange() {
        Entry e1 = new Entry();
        e1.setId(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(entryRepository.findByUserAndEntryDateBetween(eq(user), any(), any())).thenReturn(List.of(e1));

        List<Entry> result = entryService.getEntryByUserAndDateRange(1L,
                LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31));

        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("正常: エントリーを更新できる")
    void updateEntry_success() {
        Entry existing = new Entry();
        existing.setId(100L);
        existing.setUser(user);

        when(entryRepository.findById(100L)).thenReturn(Optional.of(existing));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(category));
        when(entryRepository.save(any(Entry.class))).thenAnswer(inv -> inv.getArgument(0));

        Entry result = entryService.updateEntry(1L, 100L, LocalDate.of(2026, 6, 1),
                new BigDecimal("2000"), 10L, null, EntryType.EXPENSE, "更新メモ", null, null);

        assertThat(result.getAmount()).isEqualByComparingTo("2000");
        assertThat(result.getMemo()).isEqualTo("更新メモ");
    }

    @Test
    @DisplayName("異常: 他ユーザーのエントリーは更新不可")
    void updateEntry_permissionDenied() {
        Entry existing = new Entry();
        existing.setId(100L);
        existing.setUser(otherUser);

        when(entryRepository.findById(100L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() ->
                entryService.updateEntry(1L, 100L, LocalDate.now(), BigDecimal.TEN, 10L, null, EntryType.EXPENSE, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("permission");
    }

    @Test
    @DisplayName("正常: エントリーを削除できる")
    void deleteEntry_success() {
        Entry existing = new Entry();
        existing.setId(100L);
        existing.setUser(user);

        when(entryRepository.findById(100L)).thenReturn(Optional.of(existing));

        entryService.deleteEntry(1L, 100L);
        verify(entryRepository).deleteById(100L);
    }

    @Test
    @DisplayName("異常: 他ユーザーのエントリーは削除不可")
    void deleteEntry_permissionDenied() {
        Entry existing = new Entry();
        existing.setId(100L);
        existing.setUser(otherUser);

        when(entryRepository.findById(100L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> entryService.deleteEntry(1L, 100L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("permission");
    }
}
