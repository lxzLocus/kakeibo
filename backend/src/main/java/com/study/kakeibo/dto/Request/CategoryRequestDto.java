package com.study.kakeibo.dto.Request;

import com.study.kakeibo.entity.EntryType;
import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class CategoryRequestDto {
    @NotBlank(message = "Name must not be blank")
    private String name;

    /** 収入用 / 支出用。未指定なら支出(EXPENSE)扱い。 */
    private EntryType type;
}
