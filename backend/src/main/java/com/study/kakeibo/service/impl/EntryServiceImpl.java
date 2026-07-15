package com.study.kakeibo.service.impl;

import com.study.kakeibo.service.EntryService;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.Store;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.repository.CategoryRepository;
import com.study.kakeibo.repository.StoreRepository;
import com.study.kakeibo.entity.User;
import java.util.List;
import java.math.BigDecimal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;

@Service
public class EntryServiceImpl implements EntryService {

    private final EntryRepository entryRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final StoreRepository storeRepository;

    @Autowired
    public EntryServiceImpl(
        EntryRepository entryRepository,
        UserRepository userRepository,
        CategoryRepository categoryRepository,
        StoreRepository storeRepository
    ) {
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.storeRepository = storeRepository;
    }

    // エントリーの追加
    public Entry addEntry(
        Long userId,
        LocalDate date,
        BigDecimal amount,
        Long categoryId,
        Long storeId,
        EntryType type,
        String memo,
        String note,
        Long fundPoolId,
        boolean excludeFromSimulation
    ) {
        // ユーザーの存在確認
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        // カテゴリの存在確認
        Category category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + categoryId));
        if (!category.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Category does not belong to the user.");
        }

        // ストアの存在確認（nullable）
        Store store = null;
        if (storeId != null) {
            store = storeRepository.findById(storeId)
                .orElseThrow(() -> new IllegalArgumentException("Store not found with id: " + storeId));
            if (!store.getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("Store does not belong to the user.");
            }
        }

        Entry newEntry = new Entry();
        newEntry.setUser(user);
        newEntry.setEntryDate(date);
        newEntry.setAmount(amount);
        newEntry.setCategory(category);
        newEntry.setStore(store);
        newEntry.setType(type);
        newEntry.setMemo(memo);
        newEntry.setNote(note);
        newEntry.setFundPoolId(fundPoolId);
        newEntry.setExcludeFromSimulation(excludeFromSimulation);

        return entryRepository.save(newEntry);
    }

    // エントリーの取得（全期間）
    public List<Entry> getEntryByUserId(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        return entryRepository.findByUser(user);
    }
            

    // エントリーの取得（ユーザーと期間指定）
    public List<Entry> getEntryByUserAndDateRange(Long userId, LocalDate startDate, LocalDate endDate) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        return entryRepository.findByUserAndEntryDateBetween(user, startDate, endDate);
    }


    // エントリーの更新
    public Entry updateEntry(
        Long userId,
        Long entryId,
        LocalDate date,
        BigDecimal amount,
        Long categoryId,
        Long storeId,
        EntryType type,
        String memo,
        String note,
        Long fundPoolId,
        boolean excludeFromSimulation
    ) {
        Entry existingEntry = entryRepository.findById(entryId)
            .orElseThrow(() -> new IllegalArgumentException("Entry not found with id: " + entryId));

        if (!existingEntry.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("You do not have permission to update this entry.");
        }

        Category category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + categoryId));
        if (!category.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Category does not belong to the user.");
        }

        Store store = null;
        if (storeId != null) {
            store = storeRepository.findById(storeId)
                .orElseThrow(() -> new IllegalArgumentException("Store not found with id: " + storeId));
            if (!store.getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("Store does not belong to the user.");
            }
        }

        existingEntry.setEntryDate(date);
        existingEntry.setAmount(amount);
        existingEntry.setCategory(category);
        existingEntry.setStore(store);
        existingEntry.setType(type);
        existingEntry.setMemo(memo);
        existingEntry.setNote(note);
        existingEntry.setFundPoolId(fundPoolId);
        existingEntry.setExcludeFromSimulation(excludeFromSimulation);

        return entryRepository.save(existingEntry);
    }

    // エントリーの削除
    public void deleteEntry(Long userId, Long entryId) {
        Entry existingEntry = entryRepository.findById(entryId)
            .orElseThrow(() -> new IllegalArgumentException("Entry not found with id: " + entryId));

        if (!existingEntry.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("You do not have permission to delete this entry.");
        }
        entryRepository.deleteById(entryId);
    }

    // ユーザーの全取引を削除（データリセット）
    @org.springframework.transaction.annotation.Transactional
    public void deleteAllEntries(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        entryRepository.deleteAllByUser(user);
    }

}
