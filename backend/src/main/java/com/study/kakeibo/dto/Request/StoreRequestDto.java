package com.study.kakeibo.dto.Request;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class StoreRequestDto {
    @NotBlank(message = "Name must not be blank")
    private String name;

    // 種別（コンビニ/スーパー等）は任意
    private String type;
}
