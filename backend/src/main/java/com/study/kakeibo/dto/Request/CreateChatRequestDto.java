package com.study.kakeibo.dto.Request;

import lombok.Data;

@Data
public class CreateChatRequestDto {
    /** 任意。未指定なら「新しいチャット」。 */
    private String title;
}
