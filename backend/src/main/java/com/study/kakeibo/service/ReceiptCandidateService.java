package com.study.kakeibo.service;

import com.study.kakeibo.entity.Category;
import com.study.kakeibo.entity.Entry;
import com.study.kakeibo.entity.EntryType;
import com.study.kakeibo.entity.Store;
import com.study.kakeibo.entity.User;
import com.study.kakeibo.repository.CategoryRepository;
import com.study.kakeibo.repository.EntryRepository;
import com.study.kakeibo.repository.StoreRepository;
import com.study.kakeibo.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * OCR補正時に、ユーザーの既存データ（店舗・カテゴリ・過去エントリー）から、
 * OCRテキストに関連度の高い候補をコードベースのスコアリングで選び、LLMに提示するためのサービス。
 *
 * 学習済みモデルは使わず、ユーザー自身のデータからの統計・文字列類似で一般的にスコア付けする：
 *  - 店舗:   OCRテキストとの文字列類似（部分一致＋文字bigramの含有率）
 *  - カテゴリ: 利用頻度（全体）＋ 名称のテキスト一致 ＋ 最も一致した店舗との共起頻度
 * 候補が無ければ空を返し、LLM側で一般的なものを生成させる。
 */
@Service
public class ReceiptCandidateService {

    private static final int MAX_STORES = 5;
    private static final int MAX_CATEGORIES = 5;
    private static final double STORE_MATCH_THRESHOLD = 0.5;

    private final CategoryRepository categoryRepository;
    private final StoreRepository storeRepository;
    private final EntryRepository entryRepository;
    private final UserRepository userRepository;

    public ReceiptCandidateService(CategoryRepository categoryRepository,
                                   StoreRepository storeRepository,
                                   EntryRepository entryRepository,
                                   UserRepository userRepository) {
        this.categoryRepository = categoryRepository;
        this.storeRepository = storeRepository;
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
    }

    /** LLMへ提示する候補（関連度の高い順）。 */
    public record Candidates(List<String> stores, List<String> categories) {
    }

    public Candidates suggest(Long userId, String ocrText) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || ocrText == null || ocrText.isBlank()) {
            return new Candidates(List.of(), List.of());
        }
        String norm = normalize(ocrText);

        List<Store> stores = storeRepository.findByUser(user);
        List<Category> categories = categoryRepository.findByUser(user).stream()
                .filter(c -> c.getType() == EntryType.EXPENSE)
                .toList();
        List<Entry> entries = entryRepository.findByUser(user);

        // --- 店舗候補: 部分一致（強）＋ 文字bigram含有率（弱） ---
        List<Scored> storeScores = new ArrayList<>();
        for (Store s : stores) {
            String name = normalize(s.getName());
            if (name.isBlank()) continue;
            double sc = norm.contains(name) ? 2.0 : bigramContainment(norm, name);
            if (sc >= STORE_MATCH_THRESHOLD) {
                storeScores.add(new Scored(s.getName(), sc));
            }
        }
        storeScores.sort((a, b) -> Double.compare(b.score, a.score));
        List<String> topStores = new ArrayList<>();
        for (Scored sc : storeScores) {
            if (topStores.size() >= MAX_STORES) break;
            topStores.add(sc.value);
        }
        String bestStoreNorm = topStores.isEmpty() ? null : normalize(topStores.get(0));

        // --- カテゴリ候補: 頻度 ＋ 名称一致 ＋ 一致店舗との共起 ---
        Map<String, Long> catFreq = new HashMap<>();
        Map<String, Long> catFreqWithStore = new HashMap<>();
        for (Entry e : entries) {
            if (e.getCategory() == null || e.getType() != EntryType.EXPENSE) {
                continue;
            }
            String cn = e.getCategory().getName();
            catFreq.merge(cn, 1L, Long::sum);
            if (bestStoreNorm != null && e.getStore() != null
                    && normalize(e.getStore().getName()).equals(bestStoreNorm)) {
                catFreqWithStore.merge(cn, 1L, Long::sum);
            }
        }
        long maxFreq = catFreq.values().stream().mapToLong(Long::longValue).max().orElse(1L);

        List<Scored> catScores = new ArrayList<>();
        for (Category c : categories) {
            String cn = c.getName();
            double freqScore = catFreq.getOrDefault(cn, 0L) / (double) maxFreq;      // 0..1
            double nameScore = norm.contains(normalize(cn)) ? 1.0 : 0.0;              // OCRに名称が出現
            double coScore = catFreqWithStore.getOrDefault(cn, 0L) > 0 ? 1.0 : 0.0;   // 一致店舗と共起
            double sc = freqScore + nameScore * 1.5 + coScore * 2.0;
            catScores.add(new Scored(cn, sc));
        }
        catScores.sort((a, b) -> Double.compare(b.score, a.score));
        List<String> topCats = new ArrayList<>();
        for (Scored sc : catScores) {
            if (topCats.size() >= MAX_CATEGORIES) break;
            topCats.add(sc.value);
        }

        return new Candidates(topStores, topCats);
    }

    /**
     * OCRテキストが無い（画像を直接LLMへ送る）場合の候補。
     * 店舗は利用頻度上位、カテゴリは既存の支出カテゴリ（頻度順）を返す。
     */
    public Candidates defaults(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return new Candidates(List.of(), List.of());
        }
        List<Entry> entries = entryRepository.findByUser(user);
        Map<String, Long> storeFreq = new HashMap<>();
        Map<String, Long> catFreq = new HashMap<>();
        for (Entry e : entries) {
            if (e.getType() != EntryType.EXPENSE) {
                continue;
            }
            if (e.getStore() != null) {
                storeFreq.merge(e.getStore().getName(), 1L, Long::sum);
            }
            if (e.getCategory() != null) {
                catFreq.merge(e.getCategory().getName(), 1L, Long::sum);
            }
        }
        List<String> stores = storeFreq.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(MAX_STORES)
                .map(Map.Entry::getKey)
                .toList();
        List<String> categories = categoryRepository.findByUser(user).stream()
                .filter(c -> c.getType() == EntryType.EXPENSE)
                .sorted((a, b) -> Long.compare(
                        catFreq.getOrDefault(b.getName(), 0L), catFreq.getOrDefault(a.getName(), 0L)))
                .map(Category::getName)
                .limit(12)
                .toList();
        return new Candidates(stores, categories);
    }

    /** needle の文字bigramのうち haystack に含まれる割合（0..1）。OCRの誤認識に頑健。 */
    private double bigramContainment(String haystack, String needle) {
        Set<String> hn = bigrams(haystack);
        Set<String> nn = bigrams(needle);
        if (nn.isEmpty()) {
            // 1文字の店名などは部分一致で判断
            return haystack.contains(needle) ? 1.0 : 0.0;
        }
        long found = nn.stream().filter(hn::contains).count();
        return (double) found / nn.size();
    }

    private Set<String> bigrams(String s) {
        Set<String> set = new HashSet<>();
        for (int i = 0; i + 1 < s.length(); i++) {
            set.add(s.substring(i, i + 2));
        }
        return set;
    }

    private String normalize(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[\\s　]", "");
    }

    private record Scored(String value, double score) {
    }
}
