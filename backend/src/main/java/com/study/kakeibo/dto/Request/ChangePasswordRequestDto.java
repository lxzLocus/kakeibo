package com.study.kakeibo.dto.Request;

import lombok.Data;

/** パスワード変更（現在のパスワードで本人確認する）。 */
@Data
public class ChangePasswordRequestDto {
    private String currentPassword;
    private String newPassword;
}
