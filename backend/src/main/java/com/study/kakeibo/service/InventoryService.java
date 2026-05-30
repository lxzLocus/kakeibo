package com.study.kakeibo.service;

import com.study.kakeibo.dto.Request.InventoryRequestDto;
import com.study.kakeibo.dto.Response.InventoryResponseDto;
import java.util.List;

public interface InventoryService {
    InventoryResponseDto create(Long userId, InventoryRequestDto dto);
    
    // storageがnullの場合は全ての未消費在庫を返す
    List<InventoryResponseDto> getAll(Long userId, String storage);
    
    List<InventoryResponseDto> getExpiringSoon(Long userId, int days);
    
    InventoryResponseDto update(Long userId, Long id, InventoryRequestDto dto);
    
    InventoryResponseDto consume(Long userId, Long id);
    
    void delete(Long userId, Long id);
}
