package com.study.kakeibo.dto.Request;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class CategoryRequestDto {
    @NotBlank(message = "Name must not be blank")
    private String name;
}
