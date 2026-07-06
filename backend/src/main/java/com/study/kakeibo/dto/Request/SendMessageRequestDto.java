package com.study.kakeibo.dto.Request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SendMessageRequestDto {
    @NotBlank
    @Size(max = 4000)
    private String content;
}
