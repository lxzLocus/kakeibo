package com.study.kakeibo.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ShoppingItemResponseDto {
    private Long id;
    private String name;
    /** LLM推定の数量・容量の目安（例: "12ロール"）。無ければ null。 */
    private String quantity;
    /** LLM推定のおおよその価格（円）。無ければ null。 */
    private Integer estimatedPrice;
    private boolean checked;
}
