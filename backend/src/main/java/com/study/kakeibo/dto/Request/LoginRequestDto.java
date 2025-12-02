package com.study.kakeibo.dto.Request;

import lombok.Data;

@Data
public class LoginRequestDto {
    private String email;
    private String password;
}