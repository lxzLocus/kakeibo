package com.study.kakeibo.service;

import com.study.kakeibo.entity.User;


public interface UserService {

    // ユーザー登録
    User registerUser(String username, String email, String rawPassword);

    // ユーザー認証
    User authenticateUser(String email, String rawPassword);

    // IDでユーザー取得
    User getById(Long userId);

    // ユーザー名・メールアドレスの更新
    User updateProfile(Long userId, String username, String email);

    // パスワード変更（現在のパスワードで本人確認）
    void changePassword(Long userId, String currentPassword, String newPassword);
}
