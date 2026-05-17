package com.study.kakeibo.service;

import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import java.time.LocalDate;
import java.util.List;


import java.math.BigDecimal;

public interface EntryService {

    // エントリーの追加
    Entry addEntry(
        Long userId,
        LocalDate date,
        BigDecimal amount,
        Long categoryId,
        Long storeId,
        EntryType type,
        String memo
    );


    // エントリーの取得（全期間）
    List<Entry> getEntryByUserId(Long userId);

    // エントリーの取得（ユーザーと期間指定）
    List<Entry> getEntryByUserAndDateRange(
        Long userId, 
        LocalDate startDate, 
        LocalDate endDate
    );

    // エントリーの更新
    Entry updateEntry(
        Long entryId,
        LocalDate date,
        BigDecimal amount,
        Long categoryId,
        Long storeId,
        EntryType type,
        String memo
    );

    // エントリーの削除
    void deleteEntry(Long entryId);
}
