package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.*;
import com.study.kakeibo.dto.Response.*;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")  // <- Base URL
public class UserController {

    @Autowired
    private UserService userService;

    // 登録
    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> registerUser(@RequestBody RegisterRequestDto request) {
        try {
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
        } catch (IllegalArgumentException e) {
            // メールアドレスが既に使用されている場合など
            return ResponseEntity.badRequest().build();
        }
    }

    // ログイン
    @PostMapping("/login")
    public ResponseEntity<UserResponseDto> loginUser(@RequestBody LoginRequestDto request) {
        try {
            User user = userService.authenticateUser(request.getEmail(), request.getPassword());
            UserResponseDto response = new UserResponseDto(
                    user.getId(),
                    user.getUsername(),
                    user.getEmail()
            );
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            // メールアドレスまたはパスワードが間違っている場合
            return ResponseEntity.status(401).build();  // 401 Unauthorized
        }
    }
}