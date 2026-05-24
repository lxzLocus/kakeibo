package com.study.kakeibo.dto.Request;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class StoreRequestDto {
    @NotBlank(message = "Name must not be blank")
    private String name;
    
    @NotBlank(message = "Type must not be blank")
    private String type;
}
