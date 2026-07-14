package com.study.kakeibo.dto.Request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 資金プール間の振替リクエスト。 */
@Data
public class TransferRequestDto {
    @NotNull(message = "振替元を選択してください。")
    private Long fromPoolId;

    @NotNull(message = "振替先を選択してください。")
    private Long toPoolId;

    @NotNull(message = "金額を入力してください。")
    private BigDecimal amount;

    @NotNull(message = "日付を入力してください。")
    private LocalDate transferDate;

    private String memo;
}
