package com.study.kakeibo.dto.Request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateChatTitleRequestDto {
    @NotBlank
    @Size(max = 100)
    private String title;
}
