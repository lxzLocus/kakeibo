package com.study.kakeibo.service;

import com.study.kakeibo.dto.Request.ShoppingItemUpdateDto;
import com.study.kakeibo.entity.LlmPurpose;
import com.study.kakeibo.entity.ShoppingItem;
import com.study.kakeibo.repository.ShoppingItemRepository;
import com.study.kakeibo.service.llm.LlmClient;
import com.study.kakeibo.service.llm.LlmConfig;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

/**
 * 買い物リスト（todo）。品名を追加するとチャット用LLMで数量・価格の目安を推定して保存する。
 * 合計はフロントで各アイテムの推定価格を合算し、買い物の概算費用として表示する。
 */
@Service
public class ShoppingService {

    private final ShoppingItemRepository repository;
    private final LlmConfigService llmConfigService;
    private final LlmClient llmClient;
    private final ObjectMapper objectMapper;

    public ShoppingService(ShoppingItemRepository repository,
                           LlmConfigService llmConfigService,
                           LlmClient llmClient,
                           ObjectMapper objectMapper) {
        this.repository = repository;
        this.llmConfigService = llmConfigService;
        this.llmClient = llmClient;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<ShoppingItem> list(Long userId) {
        return repository.findByUserIdOrderByCreatedAtAscIdAsc(userId);
    }

    /**
     * 品名を追加する（この時点ではLLM推定を行わず即時登録）。
     * 数量・価格の推定は、まとめて {@link #estimatePending(Long)} で行うことでLLM呼び出し回数を抑える。
     */
    @Transactional
    public ShoppingItem add(Long userId, String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("品名を入力してください。");
        }
        ShoppingItem item = new ShoppingItem();
        item.setUserId(userId);
        item.setName(name.trim());
        return repository.save(item);
    }

    /**
     * まだ見積り（価格）のないアイテムを、1回のLLM呼び出しでまとめて推定する。
     * 追加のたびに1件ずつ呼ぶのを避け、コストを抑えるための一括処理。
     * LLM未設定/失敗時は推定なしのまま返す（ベストエフォート）。
     */
    @Transactional
    public List<ShoppingItem> estimatePending(Long userId) {
        List<ShoppingItem> all = repository.findByUserIdOrderByCreatedAtAscIdAsc(userId);
        List<ShoppingItem> pending = all.stream()
                .filter(i -> i.getEstimatedPrice() == null)
                .toList();
        if (pending.isEmpty()) {
            return all;
        }
        try {
            LlmConfig cfg = llmConfigService.getDecryptedConfig(userId, LlmPurpose.CHAT);
            StringBuilder listStr = new StringBuilder();
            for (int i = 0; i < pending.size(); i++) {
                listStr.append(i + 1).append(". ").append(pending.get(i).getName()).append('\n');
            }
            String prompt = "あなたは日本の買い物価格の目安を答えるアシスタントです。\n"
                    + "次の各商品について、日本のスーパー/ドラッグストア/コンビニで一般的に1つ購入する際の"
                    + "「数量・容量の目安(quantity)」と「税込のおおよその価格（円・整数, price）」を推定してください。\n"
                    + "不明でも一般的な相場で推定します。\n"
                    + "出力は商品と同じ順序・同じ件数のJSON配列のみ（前後に説明文を付けない）。\n"
                    + "商品:\n" + listStr
                    + "例: [{\"quantity\":\"12ロール\",\"price\":600},{\"quantity\":\"1L\",\"price\":220}]";
            String raw = llmClient.chat(cfg, List.of(new LlmClient.Message("user", prompt)), 48 + pending.size() * 40);
            applyBatchEstimate(pending, raw);
            repository.saveAll(pending);
        } catch (Exception e) {
            // LLM未設定/失敗時は推定なしのまま
        }
        return repository.findByUserIdOrderByCreatedAtAscIdAsc(userId);
    }

    @Transactional
    public ShoppingItem update(Long userId, Long id, ShoppingItemUpdateDto req) {
        ShoppingItem item = getOwned(userId, id);
        if (req.getName() != null && !req.getName().isBlank()) {
            item.setName(req.getName().trim());
        }
        if (req.getQuantity() != null) {
            item.setQuantity(req.getQuantity().isBlank() ? null : req.getQuantity().trim());
        }
        if (req.getEstimatedPrice() != null) {
            item.setEstimatedPrice(req.getEstimatedPrice() < 0 ? null : req.getEstimatedPrice());
        }
        if (req.getChecked() != null) {
            item.setChecked(req.getChecked());
        }
        return repository.save(item);
    }

    /** LLMで数量・価格を再推定する。 */
    @Transactional
    public ShoppingItem reestimate(Long userId, Long id) {
        ShoppingItem item = getOwned(userId, id);
        estimateInto(userId, item);
        return repository.save(item);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        ShoppingItem item = getOwned(userId, id);
        repository.delete(item);
    }

    private ShoppingItem getOwned(Long userId, Long id) {
        return repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("アイテムが見つかりません: " + id));
    }

    /**
     * チャット用LLMで品名から数量・価格の目安を推定し、item に反映する。
     * LLM未設定や失敗時は推定なし（quantity/estimatedPrice は null のまま）。
     */
    private void estimateInto(Long userId, ShoppingItem item) {
        try {
            LlmConfig cfg = llmConfigService.getDecryptedConfig(userId, LlmPurpose.CHAT);
            String prompt = "あなたは日本の買い物価格の目安を答えるアシスタントです。\n"
                    + "商品名『" + item.getName() + "』について、日本のスーパー/ドラッグストア/コンビニで"
                    + "一般的に1つ購入する際の「数量・容量の目安」と「税込のおおよその価格（円・整数）」を推定してください。\n"
                    + "不明な場合でも一般的な相場で推定します。\n"
                    + "出力はJSONオブジェクトのみ（前後に説明文を付けない）。\n"
                    + "例: {\"quantity\":\"12ロール\",\"price\":600}";
            String raw = llmClient.chat(cfg, List.of(new LlmClient.Message("user", prompt)), 128);
            applyEstimate(item, raw);
        } catch (Exception e) {
            // LLM未設定/失敗時は推定なしで登録する（アイテム自体は保存する）
        }
    }

    /** LLM応答から最初のJSONオブジェクトを取り出し、quantity/price を item に反映する。 */
    private void applyEstimate(ShoppingItem item, String raw) {
        if (raw == null) {
            return;
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return;
        }
        try {
            JsonNode node = objectMapper.readTree(raw.substring(start, end + 1));
            applyNode(item, node);
        } catch (Exception ignore) {
            // 解析失敗時は推定なし
        }
    }

    /** LLM応答のJSON配列を、順序どおりに各アイテムへ反映する（バッチ推定用）。 */
    private void applyBatchEstimate(List<ShoppingItem> items, String raw) {
        if (raw == null) {
            return;
        }
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return;
        }
        try {
            JsonNode arr = objectMapper.readTree(raw.substring(start, end + 1));
            if (!arr.isArray()) {
                return;
            }
            for (int i = 0; i < items.size() && i < arr.size(); i++) {
                applyNode(items.get(i), arr.get(i));
            }
        } catch (Exception ignore) {
            // 解析失敗時は推定なし
        }
    }

    /** 1件分のJSONノード（{quantity, price}）を item に反映する。 */
    private void applyNode(ShoppingItem item, JsonNode node) {
        if (node == null || !node.isObject()) {
            return;
        }
        JsonNode q = node.path("quantity");
        if (!q.isMissingNode() && !q.isNull()) {
            String quantity = q.asString();
            if (quantity != null && !quantity.isBlank()) {
                item.setQuantity(quantity.trim());
            }
        }
        JsonNode p = node.path("price");
        if (!p.isMissingNode() && !p.isNull()) {
            String digits = p.asString().replaceAll("[^0-9]", "");
            if (!digits.isEmpty()) {
                item.setEstimatedPrice(Integer.parseInt(digits));
            }
        }
    }
}
