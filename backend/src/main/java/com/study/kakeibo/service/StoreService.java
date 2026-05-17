package com.study.kakeibo.service;

import com.study.kakeibo.entity.Store;
import java.util.List;

public interface StoreService {

    // 店舗の追加
    Store addStore(Long userId, String name, String type);

    // ユーザーの店舗一覧取得
    List<Store> getStoresByUserId(Long userId);

    // 店舗IDで取得
    Store getStoreById(Long storeId);

    // 店舗の更新
    Store updateStore(Long storeId, String name, String type);

    // 店舗の削除
    void deleteStore(Long storeId);

    // 店舗名で存在確認（ユーザースコープ）
    boolean existsUserStore(Long userId, String name);
}
