package com.study.kakeibo.service;

import com.study.kakeibo.dto.Request.MealRequestDto;
import com.study.kakeibo.dto.Response.MealResponseDto;

import java.util.List;

public interface MealService {
    MealResponseDto create(Long userId, MealRequestDto dto);
    
    List<MealResponseDto> getAll(Long userId, String since, String until);
    
    MealResponseDto getById(Long userId, Long id);
    
    void delete(Long userId, Long id);
}
