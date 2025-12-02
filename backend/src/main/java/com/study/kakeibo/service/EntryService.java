package com.study.kakeibo.service;

import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.entity.User;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;

@Service
public class EntryService {

    private final EntryRepository entryRepository;
    private final UserRepository userRepository;

    @Autowired
    public EntryService(EntryRepository entryRepository, UserRepository userRepository) {
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
    }

    // エントリーの追加
    public Entry addEntry(
        Long userId,
        LocalDate date,
        Double amount,
        String category,
        EntryType type,
        String memo
    ) {
        // ユーザーの存在確認
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        Entry newEntry = new Entry();
        newEntry.setUser(user);
        newEntry.setEntryDate(date);
        newEntry.setAmount(amount);
        newEntry.setCategory(category);
        newEntry.setMemo(memo);
        newEntry.setType(type);
        newEntry.setMemo(memo);
        newEntry.setCreatedAt(java.time.LocalDateTime.now());

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

        List<Entry> entries = entryRepository.findByUserAndEntryDateBetween(user, startDate, endDate);
        if(entries.isEmpty()) {
            throw new IllegalArgumentException("No entries found for the specified user and date range.");
        }
        return entries;
    }


    // エントリーの更新
    public Entry updateEntry(
        Long entryId,
        LocalDate date,
        Double amount,
        String category,
        EntryType type,
        String memo
    ) {
        Entry existingEntry = entryRepository.findById(entryId)
            .orElseThrow(() -> new IllegalArgumentException("Entry not found with id: " + entryId));

        existingEntry.setEntryDate(date);
        existingEntry.setAmount(amount);
        existingEntry.setCategory(category);
        existingEntry.setType(type);
        existingEntry.setMemo(memo);

        return entryRepository.save(existingEntry);
    }

    // エントリーの削除
    public void deleteEntry(Long entryId) {
        if (!entryRepository.existsById(entryId)) {
            throw new IllegalArgumentException("Entry not found with id: " + entryId);
        }
        entryRepository.deleteById(entryId);
    }

}
