package com.study.kakeibo.service;

import com.study.kakeibo.entity.User;


public interface UserService {

    // ユーザー登録
    User registerUser(String username, String email, String rawPassword);

    // ユーザー認証
    User authenticateUser(String email, String rawPassword);
}
