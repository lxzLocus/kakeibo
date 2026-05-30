package com.study.kakeibo.service.impl;

import com.study.kakeibo.dto.Request.InventoryRequestDto;
import com.study.kakeibo.dto.Response.InventoryResponseDto;
import com.study.kakeibo.entity.Inventory;
import com.study.kakeibo.entity.StorageType;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.InventoryRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.InventoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class InventoryServiceImpl implements InventoryService {

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    public InventoryResponseDto create(Long userId, InventoryRequestDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Inventory inventory = new Inventory();
        inventory.setUser(user);
        
        mapDtoToEntity(dto, inventory);
        
        Inventory saved = inventoryRepository.save(inventory);
        return mapEntityToDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryResponseDto> getAll(Long userId, String storageStr) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        List<Inventory> inventories;
        if (storageStr != null && !storageStr.isEmpty()) {
            StorageType storage = StorageType.valueOf(storageStr);
            inventories = inventoryRepository.findByUserAndStorageAndIsConsumedFalseOrderByExpiryDateAsc(user, storage);
        } else {
            inventories = inventoryRepository.findByUserAndIsConsumedFalseOrderByExpiryDateAsc(user);
        }

        return inventories.stream().map(this::mapEntityToDto).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryResponseDto> getExpiringSoon(Long userId, int days) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        LocalDate thresholdDate = LocalDate.now().plusDays(days);
        List<Inventory> expiring = inventoryRepository.findByUserAndIsConsumedFalseAndExpiryDateBeforeOrderByExpiryDateAsc(user, thresholdDate);
        return expiring.stream().map(this::mapEntityToDto).collect(Collectors.toList());
    }

    @Override
    public InventoryResponseDto update(Long userId, Long id, InventoryRequestDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Inventory inventory = inventoryRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Inventory not found or permission denied"));

        mapDtoToEntity(dto, inventory);

        Inventory saved = inventoryRepository.save(inventory);
        return mapEntityToDto(saved);
    }

    @Override
    public InventoryResponseDto consume(Long userId, Long id) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Inventory inventory = inventoryRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Inventory not found or permission denied"));

        inventory.setIsConsumed(true);
        Inventory saved = inventoryRepository.save(inventory);
        return mapEntityToDto(saved);
    }

    @Override
    public void delete(Long userId, Long id) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Inventory inventory = inventoryRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Inventory not found or permission denied"));

        inventoryRepository.delete(inventory);
    }

    private void mapDtoToEntity(InventoryRequestDto dto, Inventory entity) {
        entity.setItemName(dto.getItemName());
        entity.setQuantity(dto.getQuantity());
        entity.setUnit(dto.getUnit() != null ? dto.getUnit() : "個");
        entity.setPurchasePrice(dto.getPurchasePrice());
        
        if (dto.getPurchaseDate() != null && !dto.getPurchaseDate().isEmpty()) {
            entity.setPurchaseDate(LocalDate.parse(dto.getPurchaseDate()));
        } else {
            entity.setPurchaseDate(null);
        }

        if (dto.getExpiryDate() != null && !dto.getExpiryDate().isEmpty()) {
            entity.setExpiryDate(LocalDate.parse(dto.getExpiryDate()));
        } else {
            entity.setExpiryDate(null);
        }

        if (dto.getStorage() != null && !dto.getStorage().isEmpty()) {
            entity.setStorage(StorageType.valueOf(dto.getStorage()));
        } else {
            entity.setStorage(StorageType.REFRIGERATED); // デフォルト
        }
    }

    private InventoryResponseDto mapEntityToDto(Inventory entity) {
        InventoryResponseDto dto = new InventoryResponseDto();
        dto.setId(entity.getId());
        dto.setItemName(entity.getItemName());
        dto.setQuantity(entity.getQuantity());
        dto.setUnit(entity.getUnit());
        dto.setPurchasePrice(entity.getPurchasePrice());
        dto.setPurchaseDate(entity.getPurchaseDate());
        dto.setExpiryDate(entity.getExpiryDate());
        dto.setStorage(entity.getStorage());
        dto.setIsConsumed(entity.getIsConsumed());
        dto.setCreatedAt(entity.getCreatedAt());

        if (entity.getExpiryDate() != null) {
            long days = ChronoUnit.DAYS.between(LocalDate.now(), entity.getExpiryDate());
            dto.setDaysUntilExpiry(days);
        }

        return dto;
    }
}
