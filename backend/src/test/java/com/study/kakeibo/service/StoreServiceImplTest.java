package com.study.kakeibo.service;

import com.study.kakeibo.entity.Store;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.StoreRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.impl.StoreServiceImpl;
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
class StoreServiceImplTest {

    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private StoreServiceImpl storeService;

    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);

        otherUser = new User();
        otherUser.setId(99L);
    }

    @Test
    @DisplayName("正常: 店舗を追加できる")
    void addStore_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(storeRepository.existsByUserAndName(user, "セブン")).thenReturn(false);
        when(storeRepository.save(any(Store.class))).thenAnswer(inv -> {
            Store s = inv.getArgument(0);
            s.setId(20L);
            return s;
        });

        Store result = storeService.addStore(1L, "セブン", "コンビニ");

        assertThat(result.getId()).isEqualTo(20L);
        assertThat(result.getName()).isEqualTo("セブン");
        assertThat(result.getType()).isEqualTo("コンビニ");
    }

    @Test
    @DisplayName("異常: 重複店舗名で例外")
    void addStore_duplicateName() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(storeRepository.existsByUserAndName(user, "セブン")).thenReturn(true);

        assertThatThrownBy(() -> storeService.addStore(1L, "セブン", "コンビニ"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    @DisplayName("正常: ユーザーの店舗一覧を取得")
    void getStoresByUserId() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(storeRepository.findByUser(user)).thenReturn(List.of(new Store(), new Store()));

        List<Store> result = storeService.getStoresByUserId(1L);
        assertThat(result).hasSize(2);
    }

    @Test
    @DisplayName("正常: 店舗を更新できる")
    void updateStore_success() {
        Store existing = new Store();
        existing.setId(20L);
        existing.setUser(user);
        existing.setName("セブン");

        when(userRepository.existsById(1L)).thenReturn(true);
        when(storeRepository.findById(20L)).thenReturn(Optional.of(existing));
        when(storeRepository.save(any(Store.class))).thenAnswer(inv -> inv.getArgument(0));

        Store result = storeService.updateStore(1L, 20L, "ファミマ", "コンビニ");
        assertThat(result.getName()).isEqualTo("ファミマ");
    }

    @Test
    @DisplayName("異常: 他ユーザーの店舗は更新不可")
    void updateStore_permissionDenied() {
        Store existing = new Store();
        existing.setId(20L);
        existing.setUser(otherUser);

        when(userRepository.existsById(1L)).thenReturn(true);
        when(storeRepository.findById(20L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> storeService.updateStore(1L, 20L, "不正", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("正常: 店舗を削除できる")
    void deleteStore_success() {
        Store existing = new Store();
        existing.setId(20L);
        existing.setUser(user);

        when(storeRepository.findById(20L)).thenReturn(Optional.of(existing));

        storeService.deleteStore(1L, 20L);
        verify(storeRepository).deleteById(20L);
    }

    @Test
    @DisplayName("異常: 他ユーザーの店舗は削除不可")
    void deleteStore_permissionDenied() {
        Store existing = new Store();
        existing.setId(20L);
        existing.setUser(otherUser);

        when(storeRepository.findById(20L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> storeService.deleteStore(1L, 20L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("permission");
    }
}
