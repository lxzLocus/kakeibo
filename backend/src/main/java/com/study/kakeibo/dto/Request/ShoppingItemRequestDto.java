package com.study.kakeibo.dto.Request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 買い物リストへの品目追加リクエスト。 */
@Data
public class ShoppingItemRequestDto {
    @NotBlank(message = "品名を入力してください。")
    private String name;
}
