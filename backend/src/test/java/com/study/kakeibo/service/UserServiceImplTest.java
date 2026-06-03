package com.study.kakeibo.service;

import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks private UserServiceImpl userService;

    @BeforeEach
    void setUp() {
        // Common setup if needed
    }

    @Test
    @DisplayName("正常: ユーザーを登録できる")
    void registerUser_success() {
        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode("rawpass")).thenReturn("$2a$10$hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });

        User result = userService.registerUser("テスト", "test@example.com", "rawpass");

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getUsername()).isEqualTo("テスト");
        assertThat(result.getEmail()).isEqualTo("test@example.com");
        assertThat(result.getPassword()).isEqualTo("$2a$10$hashed"); // ハッシュ化されている
        verify(passwordEncoder).encode("rawpass");
    }

    @Test
    @DisplayName("異常: 重複メールで例外")
    void registerUser_duplicateEmail() {
        when(userRepository.existsByEmail("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.registerUser("テスト", "dup@example.com", "pass"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Email is already in use");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("正常: ログインに成功する")
    void authenticateUser_success() {
        User user = new User();
        user.setId(1L);
        user.setEmail("test@example.com");
        user.setPassword("$2a$10$hashed");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("rawpass", "$2a$10$hashed")).thenReturn(true);

        User result = userService.authenticateUser("test@example.com", "rawpass");
        assertThat(result.getId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("異常: メールが見つからない場合の例外")
    void authenticateUser_emailNotFound() {
        when(userRepository.findByEmail("notfound@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.authenticateUser("notfound@example.com", "pass"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid email or password");
    }

    @Test
    @DisplayName("異常: パスワード不一致で例外")
    void authenticateUser_wrongPassword() {
        User user = new User();
        user.setId(1L);
        user.setEmail("test@example.com");
        user.setPassword("$2a$10$hashed");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongpass", "$2a$10$hashed")).thenReturn(false);

        assertThatThrownBy(() -> userService.authenticateUser("test@example.com", "wrongpass"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid email or password");
    }
}
