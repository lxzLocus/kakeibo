package com.study.kakeibo.service;

import com.study.kakeibo.dto.Response.AdminOverviewDto;
import com.study.kakeibo.dto.Response.AdminOverviewDto.AutomationInfo;
import com.study.kakeibo.dto.Response.AdminOverviewDto.Counts;
import com.study.kakeibo.dto.Response.AdminOverviewDto.EvaluationInfo;
import com.study.kakeibo.dto.Response.AdminOverviewDto.LlmInfo;
import com.study.kakeibo.dto.Response.AdminOverviewDto.MemoryInfo;
import com.study.kakeibo.dto.Response.AdminOverviewDto.PoolInfo;
import com.study.kakeibo.entity.LlmPurpose;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 「管理」ビュー: アプリが裏で自動管理しているデータを読み取り専用で集約する。
 */
@Service
public class AdminService {

    private final UserRepository userRepository;
    private final EntryRepository entryRepository;
    private final CategoryRepository categoryRepository;
    private final StoreRepository storeRepository;
    private final FundPoolRepository poolRepository;
    private final FundTransferRepository transferRepository;
    private final FixedCostRepository fixedCostRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final UserMemoryRepository userMemoryRepository;
    private final UserEvaluationRepository userEvaluationRepository;
    private final UserLlmConfigRepository llmConfigRepository;
    private final EvaluationService evaluationService;

    public AdminService(UserRepository userRepository, EntryRepository entryRepository,
                        CategoryRepository categoryRepository, StoreRepository storeRepository,
                        FundPoolRepository poolRepository, FundTransferRepository transferRepository,
                        FixedCostRepository fixedCostRepository, ChatSessionRepository chatSessionRepository,
                        UserMemoryRepository userMemoryRepository, UserEvaluationRepository userEvaluationRepository,
                        UserLlmConfigRepository llmConfigRepository, EvaluationService evaluationService) {
        this.evaluationService = evaluationService;
        this.userRepository = userRepository;
        this.entryRepository = entryRepository;
        this.categoryRepository = categoryRepository;
        this.storeRepository = storeRepository;
        this.poolRepository = poolRepository;
        this.transferRepository = transferRepository;
        this.fixedCostRepository = fixedCostRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.userMemoryRepository = userMemoryRepository;
        this.userEvaluationRepository = userEvaluationRepository;
        this.llmConfigRepository = llmConfigRepository;
    }

    @Transactional(readOnly = true)
    public AdminOverviewDto overview(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        Counts counts = Counts.builder()
                .entries(entryRepository.countByUser(user))
                .categories(categoryRepository.findByUser(user).size())
                .stores(storeRepository.findByUser(user).size())
                .pools(poolRepository.countByUserId(userId))
                .transfers(transferRepository.countByUserId(userId))
                .fixedCosts(fixedCostRepository.findByUserIdOrderByIdAsc(userId).size())
                .chatSessions(chatSessionRepository.findByUserIdOrderByUpdatedAtDesc(userId).size())
                .build();

        List<LlmInfo> llm = new ArrayList<>();
        for (LlmPurpose p : List.of(LlmPurpose.CHAT, LlmPurpose.VISION)) {
            llm.add(llmConfigRepository.findByUserIdAndPurpose(userId, p)
                    .map(c -> LlmInfo.builder()
                            .purpose(p.name()).configured(true).model(c.getModel()).baseUrl(c.getBaseUrl())
                            .supportsVision(c.isSupportsVision()).supportsTools(c.getSupportsTools())
                            .directOcr(c.isDirectOcr()).build())
                    .orElse(LlmInfo.builder().purpose(p.name()).configured(false).build()));
        }

        MemoryInfo memory = userMemoryRepository.findByUserId(userId)
                .map(mm -> MemoryInfo.builder()
                        .present(mm.getContent() != null && !mm.getContent().isBlank())
                        .length(mm.getContent() == null ? 0 : mm.getContent().length())
                        .updatedAt(mm.getUpdatedAt()).build())
                .orElse(MemoryInfo.builder().present(false).length(0).build());

        EvaluationInfo evaluation = userEvaluationRepository.findByUserId(userId)
                .map(e -> EvaluationInfo.builder()
                        .frequency(e.getFrequency()).lastRunAt(e.getLastRunAt())
                        .summary(evaluationService.summaryOf(e)).build())
                .orElse(EvaluationInfo.builder().frequency("OFF").build());

        AutomationInfo automation = AutomationInfo.builder()
                .fixedCostPostedEntries(entryRepository.countByUserAndFixedCostIdIsNotNull(user))
                .cardSettlementTransfers(transferRepository.countByUserIdAndAutoCardIdIsNotNull(userId))
                .build();

        List<PoolInfo> pools = poolRepository.findByUserIdOrderBySortOrderAscIdAsc(userId).stream()
                .map(pp -> PoolInfo.builder()
                        .id(pp.getId()).name(pp.getName()).kind(pp.getKind()).primary(pp.isPrimary())
                        .closingDay(pp.getClosingDay()).paymentDay(pp.getPaymentDay())
                        .settlementPoolId(pp.getSettlementPoolId()).autoSettle(pp.isAutoSettle()).build())
                .toList();

        return AdminOverviewDto.builder()
                .counts(counts).llm(llm).memory(memory).evaluation(evaluation)
                .automation(automation).pools(pools).build();
    }
}
