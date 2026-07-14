package com.study.kakeibo.dto.Request;

import lombok.Data;

/** 買い物アイテムの部分更新（各フィールドは任意。null は変更しない）。 */
@Data
public class ShoppingItemUpdateDto {
    private String name;
    private String quantity;
    private Integer estimatedPrice;
    private Boolean checked;
}
