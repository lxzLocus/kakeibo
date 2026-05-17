package com.study.kakeibo.service;

import com.study.kakeibo.model.Expense;
import com.study.kakeibo.dto.Request.ExpenseCreateRequest;

public interface ExpenseService {

    // 支出作成
    Expense CreateExpense(
        Long userId,
        ExpenseCreateRequest request
    );
}