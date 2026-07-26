package com.study.kakeibo.service.impl;

import com.study.kakeibo.service.UserService;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;


@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    public UserServiceImpl(UserRepository userRepository, PasswordEncoder passwordEncoder){
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ユーザー登録
    public User registerUser(String username, String email, String rawPassword) {

        // すでに作成されていないことを確認 
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email is already in use.");
        }

        String encodedPassword = passwordEncoder.encode(rawPassword);
        User newUser = new User();
        newUser.setUsername(username);
        newUser.setEmail(email);
        newUser.setPassword(encodedPassword);

        return userRepository.save(newUser);
    }

    // ユーザー認証
    public User authenticateUser(String email, String rawPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password."));

        if (passwordEncoder.matches(rawPassword, user.getPassword())) {
            return user;
        } else {
            throw new IllegalArgumentException("Invalid email or password.");
        }
    }

    @Override
    public User getById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("ユーザーが見つかりません。"));
    }

    // ユーザー名・メールアドレスの更新
    @Override
    public User updateProfile(Long userId, String username, String email) {
        User user = getById(userId);
        if (username != null && !username.isBlank()) {
            user.setUsername(username.trim());
        }
        if (email != null && !email.isBlank()) {
            String e = email.trim();
            if (!e.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmail(e)) {
                throw new IllegalArgumentException("このメールアドレスは既に使われています。");
            }
            user.setEmail(e);
        }
        return userRepository.save(user);
    }

    // パスワード変更（現在のパスワードで本人確認）
    @Override
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = getById(userId);
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("新しいパスワードは6文字以上にしてください。");
        }
        if (!passwordEncoder.matches(currentPassword == null ? "" : currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("現在のパスワードが正しくありません。");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}