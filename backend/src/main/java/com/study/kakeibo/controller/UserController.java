package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.*;
import com.study.kakeibo.dto.Response.*;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {

    @Autowired
    private UserService userService;

    // 登録
    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> registerUser(@RequestBody RegisterRequestDto request) {
        User newUser = userService.registerUser(
                request.getUsername(),
                request.getEmail(),
                request.getPassword()
        );

        UserResponseDto response = new UserResponseDto(
                newUser.getId(),
                newUser.getUsername(),
                newUser.getEmail()
        );

        return ResponseEntity.ok(response);
    }

    // ログイン
    @PostMapping("/login")
    public ResponseEntity<UserResponseDto> loginUser(@RequestBody LoginRequestDto request) {
        User user = userService.authenticateUser(request.getEmail(), request.getPassword());
        UserResponseDto response = new UserResponseDto(
                user.getId(),
                user.getUsername(),
                user.getEmail()
        );
        return ResponseEntity.ok(response);
    }

    // 現在のユーザー情報
    @GetMapping("/me")
    public ResponseEntity<UserResponseDto> me(@RequestHeader("X-User-Id") Long userId) {
        User u = userService.getById(userId);
        return ResponseEntity.ok(new UserResponseDto(u.getId(), u.getUsername(), u.getEmail()));
    }

    // ユーザー名・メールアドレスの変更
    @PutMapping("/me/profile")
    public ResponseEntity<UserResponseDto> updateProfile(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody UpdateProfileRequestDto request) {
        User u = userService.updateProfile(userId, request.getUsername(), request.getEmail());
        return ResponseEntity.ok(new UserResponseDto(u.getId(), u.getUsername(), u.getEmail()));
    }

    // パスワードの変更
    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody ChangePasswordRequestDto request) {
        userService.changePassword(userId, request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.noContent().build();
    }
}