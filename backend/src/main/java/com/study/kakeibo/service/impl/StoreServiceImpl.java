package com.study.kakeibo.service.impl;

import com.study.kakeibo.service.StoreService;
import com.study.kakeibo.entity.Store;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.StoreRepository;
import com.study.kakeibo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class StoreServiceImpl implements StoreService {

    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    @Autowired
    public StoreServiceImpl(StoreRepository storeRepository, UserRepository userRepository) {
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
    }

    // 店舗の追加
    public Store addStore(Long userId, String name, String type) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        // ユーザースコープ内で名前が既に存在するか確認
        if (storeRepository.existsByUserAndName(user, name)) {
            throw new IllegalArgumentException("Store with name '" + name + "' already exists for this user.");
        }

        Store newStore = new Store();
        newStore.setUser(user);
        newStore.setName(name);
        newStore.setType(type);

        return storeRepository.save(newStore);
    }

    // ユーザーの店舗一覧取得
    public List<Store> getStoresByUserId(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        return storeRepository.findByUser(user);
    }

    // 店舗IDで取得
    public Store getStoreById(Long storeId) {
        return storeRepository.findById(storeId)
            .orElseThrow(() -> new IllegalArgumentException("Store not found with id: " + storeId));
    }

    // 店舗の更新
    public Store updateStore(Long storeId, String name, String type) {
        Store existingStore = storeRepository.findById(storeId)
            .orElseThrow(() -> new IllegalArgumentException("Store not found with id: " + storeId));

        existingStore.setName(name);
        existingStore.setType(type);
        return storeRepository.save(existingStore);
    }

    // 店舗の削除
    public void deleteStore(Long storeId) {
        if (!storeRepository.existsById(storeId)) {
            throw new IllegalArgumentException("Store not found with id: " + storeId);
        }
        storeRepository.deleteById(storeId);
    }

    // 店舗名で存在確認（ユーザースコープ）
    public boolean existsUserStore(Long userId, String name) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        return storeRepository.existsByUserAndName(user, name);
    }
}
