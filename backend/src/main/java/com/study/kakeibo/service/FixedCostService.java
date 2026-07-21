package com.study.kakeibo.service;

import com.study.kakeibo.entity.FixedCost;
import com.study.kakeibo.repository.FixedCostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class FixedCostService {

    private final FixedCostRepository fixedCostRepository;

    public FixedCostService(FixedCostRepository fixedCostRepository) {
        this.fixedCostRepository = fixedCostRepository;
    }

    @Transactional(readOnly = true)
    public List<FixedCost> list(Long userId) {
        return fixedCostRepository.findByUserIdOrderByIdAsc(userId);
    }

    @Transactional
    public FixedCost create(Long userId, String name, BigDecimal amount, Integer paymentDay,
                            boolean autoPost, Long categoryId, Long paymentPoolId) {
        validate(name, amount, paymentDay);
        FixedCost fc = new FixedCost();
        fc.setUserId(userId);
        fc.setName(name.trim());
        fc.setAmount(amount);
        fc.setPaymentDay(paymentDay);
        fc.setAutoPost(autoPost);
        fc.setCategoryId(categoryId);
        fc.setPaymentPoolId(paymentPoolId);
        return fixedCostRepository.save(fc);
    }

    @Transactional
    public FixedCost update(Long userId, Long id, String name, BigDecimal amount, Integer paymentDay,
                            boolean autoPost, Long categoryId, Long paymentPoolId) {
        validate(name, amount, paymentDay);
        FixedCost fc = fixedCostRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("固定費が見つかりません: " + id));
        fc.setName(name.trim());
        fc.setAmount(amount);
        fc.setPaymentDay(paymentDay);
        fc.setAutoPost(autoPost);
        fc.setCategoryId(categoryId);
        fc.setPaymentPoolId(paymentPoolId);
        return fixedCostRepository.save(fc);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        FixedCost fc = fixedCostRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("固定費が見つかりません: " + id));
        fixedCostRepository.delete(fc);
    }

    private void validate(String name, BigDecimal amount, Integer paymentDay) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("固定費名を入力してください。");
        }
        if (amount == null || amount.signum() < 0) {
            throw new IllegalArgumentException("金額は0以上で入力してください。");
        }
        if (paymentDay != null && (paymentDay < 1 || paymentDay > 31)) {
            throw new IllegalArgumentException("支払日は1〜31で指定してください。");
        }
    }
}
