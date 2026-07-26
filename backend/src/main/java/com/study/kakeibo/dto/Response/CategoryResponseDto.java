package com.study.kakeibo.dto.Response;

import com.study.kakeibo.entity.EntryType;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CategoryResponseDto {
    private Long categoryId;
    private Long userId;
    private String name;
    private EntryType type;
    private String groupName;   // グループ（プライマリ）。未分類は null
    private LocalDateTime createdAt;
}
