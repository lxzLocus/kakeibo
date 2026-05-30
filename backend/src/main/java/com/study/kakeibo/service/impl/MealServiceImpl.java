package com.study.kakeibo.service.impl;

import com.study.kakeibo.dto.Request.MealItemRequestDto;
import com.study.kakeibo.dto.Request.MealRequestDto;
import com.study.kakeibo.dto.Response.MealItemResponseDto;
import com.study.kakeibo.dto.Response.MealResponseDto;
import com.study.kakeibo.entity.Inventory;
import com.study.kakeibo.entity.Meal;
import com.study.kakeibo.entity.MealItem;
import com.study.kakeibo.entity.MealType;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.InventoryRepository;
import com.study.kakeibo.repository.MealItemRepository;
import com.study.kakeibo.repository.MealRepository;
import com.study.kakeibo.repository.UserRepository;
import com.study.kakeibo.service.MealService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class MealServiceImpl implements MealService {

    @Autowired
    private MealRepository mealRepository;

    @Autowired
    private MealItemRepository mealItemRepository;

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    public MealResponseDto create(Long userId, MealRequestDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Meal meal = new Meal();
        meal.setUser(user);
        meal.setMealDatetime(LocalDateTime.parse(dto.getMealDatetime()));
        meal.setMealType(MealType.valueOf(dto.getMealType()));
        meal.setTitle(dto.getTitle());
        meal.setServings(dto.getServings());
        meal.setNote(dto.getNote());

        BigDecimal totalCost = BigDecimal.ZERO;

        if (dto.getItems() != null && !dto.getItems().isEmpty()) {
            for (MealItemRequestDto itemDto : dto.getItems()) {
                Inventory inventory = inventoryRepository.findByIdAndUser(itemDto.getInventoryId(), user)
                        .orElseThrow(() -> new IllegalArgumentException("Inventory not found or permission denied"));

                MealItem mealItem = new MealItem();
                mealItem.setMeal(meal);
                mealItem.setInventory(inventory);
                mealItem.setQuantityUsed(itemDto.getQuantityUsed());

                // コスト計算: (quantityUsed / inventoryQuantity) * purchasePrice
                BigDecimal estimatedCost = BigDecimal.ZERO;
                if (inventory.getPurchasePrice() != null && inventory.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
                    estimatedCost = itemDto.getQuantityUsed()
                            .divide(inventory.getQuantity(), 4, RoundingMode.HALF_UP)
                            .multiply(inventory.getPurchasePrice())
                            .setScale(2, RoundingMode.HALF_UP);
                }
                mealItem.setEstimatedCost(estimatedCost);
                meal.getItems().add(mealItem);
                
                totalCost = totalCost.add(estimatedCost);
            }
        }

        Meal savedMeal = mealRepository.save(meal);
        return mapEntityToDto(savedMeal, totalCost);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MealResponseDto> getAll(Long userId, String since, String until) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        LocalDateTime start = LocalDateTime.parse(since + "T00:00:00");
        LocalDateTime end = LocalDateTime.parse(until + "T23:59:59");

        List<Meal> meals = mealRepository.findByUserAndMealDatetimeBetweenOrderByMealDatetimeDesc(user, start, end);
        return meals.stream().map(m -> mapEntityToDto(m, calculateTotalCost(m))).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public MealResponseDto getById(Long userId, Long id) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Meal meal = mealRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Meal not found or permission denied"));

        return mapEntityToDto(meal, calculateTotalCost(meal));
    }

    @Override
    public void delete(Long userId, Long id) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Meal meal = mealRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("Meal not found or permission denied"));

        mealRepository.delete(meal);
    }

    private BigDecimal calculateTotalCost(Meal meal) {
        return meal.getItems().stream()
                .map(MealItem::getEstimatedCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private MealResponseDto mapEntityToDto(Meal meal, BigDecimal totalCost) {
        MealResponseDto dto = new MealResponseDto();
        dto.setId(meal.getId());
        dto.setMealDatetime(meal.getMealDatetime());
        dto.setMealType(meal.getMealType().name());
        dto.setTitle(meal.getTitle());
        dto.setServings(meal.getServings());
        dto.setNote(meal.getNote());
        dto.setEstimatedTotalCost(totalCost);

        if (meal.getServings() > 0) {
            dto.setCostPerServing(totalCost.divide(BigDecimal.valueOf(meal.getServings()), 2, RoundingMode.HALF_UP));
        } else {
            dto.setCostPerServing(BigDecimal.ZERO);
        }

        List<MealItemResponseDto> itemDtos = meal.getItems().stream().map(item -> {
            MealItemResponseDto iDto = new MealItemResponseDto();
            iDto.setId(item.getId());
            iDto.setInventoryId(item.getInventory().getId());
            iDto.setItemName(item.getInventory().getItemName());
            iDto.setQuantityUsed(item.getQuantityUsed());
            iDto.setEstimatedCost(item.getEstimatedCost());
            return iDto;
        }).collect(Collectors.toList());

        dto.setItems(itemDtos);
        return dto;
    }
}
