package com.study.kakeibo.dto.Request;

import lombok.Data;

/** ユーザー名・メールアドレスの変更。 */
@Data
public class UpdateProfileRequestDto {
    private String username;
    private String email;
}
