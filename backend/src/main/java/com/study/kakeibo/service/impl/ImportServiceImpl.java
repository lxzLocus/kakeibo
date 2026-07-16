package com.study.kakeibo.service.impl;

import com.study.kakeibo.dto.Response.ImportResultDto;
import com.study.kakeibo.entity.*;
import com.study.kakeibo.repository.*;
import com.study.kakeibo.service.ImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.StringReader;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
public class ImportServiceImpl implements ImportService {

    private static final Logger log = LoggerFactory.getLogger(ImportServiceImpl.class);

    private final EntryRepository entryRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final StoreRepository storeRepository;
    private final FundPoolRepository fundPoolRepository;

    @Autowired
    public ImportServiceImpl(
            EntryRepository entryRepository,
            UserRepository userRepository,
            CategoryRepository categoryRepository,
            StoreRepository storeRepository,
            FundPoolRepository fundPoolRepository) {
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.storeRepository = storeRepository;
        this.fundPoolRepository = fundPoolRepository;
    }

    @Override
    @Transactional
    public ImportResultDto importData(Long userId, String format, String content) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        if ("csv".equalsIgnoreCase(format)) {
            return importCsv(user, content);
        } else if ("markdown".equalsIgnoreCase(format)) {
            return importMarkdown(user, content);
        } else {
            throw new IllegalArgumentException("サポートされていないフォーマットです: " + format + "（csv または markdown を指定してください）");
        }
    }

    // ===========================================
    // CSV パーサー
    // ===========================================
    private ImportResultDto importCsv(User user, String content) {
        List<String> errors = new ArrayList<>();
        List<Long> createdIds = new ArrayList<>();
        int totalRows = 0;

        // 口座名 → ID の解決マップ（大文字小文字を無視）。存在する口座のみ対象。
        Map<String, Long> poolByName = new HashMap<>();
        for (FundPool p : fundPoolRepository.findByUserIdOrderBySortOrderAscIdAsc(user.getId())) {
            poolByName.put(p.getName().trim().toLowerCase(), p.getId());
        }

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                return ImportResultDto.builder()
                        .totalRows(0).successCount(0).errorCount(1)
                        .errors(List.of("CSVが空です"))
                        .createdEntryIds(List.of())
                        .build();
            }
            // Excel等が付与する先頭のBOMを除去する
            headerLine = stripBom(headerLine);

            // ヘッダー解析（カラム位置を特定）。引用符対応パーサーで分割する。
            List<String> headers = parseCsvLine(headerLine);
            Map<String, Integer> colMap = new HashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                colMap.put(headers.get(i).trim(), i);
            }

            // 必須カラムのチェック
            if (!colMap.containsKey("日付") || !colMap.containsKey("金額")) {
                return ImportResultDto.builder()
                        .totalRows(0).successCount(0).errorCount(1)
                        .errors(List.of("必須カラム「日付」と「金額」がヘッダーに見つかりません。"
                                + "認識する列: 日付,金額,カテゴリ,店舗,メモ,タイプ,口座,備考,除外"))
                        .createdEntryIds(List.of())
                        .build();
            }

            String line;
            int lineNum = 1;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.isBlank()) continue;
                totalRows++;

                try {
                    List<String> cols = parseCsvLine(line);

                    // 日付
                    String dateStr = getCol(cols, colMap, "日付").trim();
                    LocalDate date = LocalDate.parse(dateStr);

                    // 金額（桁区切りカンマは許容して除去）
                    String amountStr = getCol(cols, colMap, "金額").trim().replace(",", "");
                    BigDecimal amount = new BigDecimal(amountStr);
                    if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                        errors.add("行" + lineNum + ": 金額は0より大きい必要があります");
                        continue;
                    }

                    // タイプ判定（デフォルトはEXPENSE）。INCOME/収入 のみ収入扱い。
                    String typeStr = getCol(cols, colMap, "タイプ").trim();
                    EntryType type = ("INCOME".equalsIgnoreCase(typeStr) || "収入".equals(typeStr))
                            ? EntryType.INCOME : EntryType.EXPENSE;

                    // カテゴリ（自動作成。カテゴリの区分は収支タイプに合わせる）
                    String categoryName = getCol(cols, colMap, "カテゴリ").trim();
                    if (categoryName.isEmpty()) {
                        categoryName = "その他";
                    }
                    Category category = getOrCreateCategory(user, categoryName, type);

                    // 店舗（任意、自動作成）
                    String storeName = getCol(cols, colMap, "店舗").trim();
                    Store store = storeName.isEmpty() ? null : getOrCreateStore(user, storeName, null);

                    // メモ（品名）・備考（自由メモ, note）
                    String memo = getCol(cols, colMap, "メモ").trim();
                    String note = getCol(cols, colMap, "備考").trim();
                    if (note.isEmpty()) note = getCol(cols, colMap, "note").trim();

                    // 口座（任意）。既存の口座名に一致すれば紐づけ、未指定/不一致は null（主口座扱い）。
                    String poolName = getCol(cols, colMap, "口座").trim();
                    Long fundPoolId = poolName.isEmpty() ? null : poolByName.get(poolName.toLowerCase());
                    if (!poolName.isEmpty() && fundPoolId == null) {
                        errors.add("行" + lineNum + ": 口座「" + poolName + "」が見つからないため主口座に登録しました");
                    }

                    // シミュレーション除外（任意）。1/true/yes/除外 で true。
                    boolean excludeFromSim = isTruthy(getCol(cols, colMap, "除外").trim());

                    Entry entry = new Entry();
                    entry.setUser(user);
                    entry.setEntryDate(date);
                    entry.setAmount(amount);
                    entry.setCategory(category);
                    entry.setStore(store);
                    entry.setType(type);
                    entry.setMemo(memo.isEmpty() ? null : memo);
                    entry.setNote(note.isEmpty() ? null : note);
                    entry.setFundPoolId(fundPoolId);
                    entry.setExcludeFromSimulation(excludeFromSim);

                    Entry saved = entryRepository.save(entry);
                    createdIds.add(saved.getId());

                } catch (DateTimeParseException e) {
                    errors.add("行" + lineNum + ": 日付の形式が不正です（yyyy-MM-dd形式で指定してください）");
                } catch (NumberFormatException e) {
                    errors.add("行" + lineNum + ": 金額が数値ではありません");
                } catch (Exception e) {
                    errors.add("行" + lineNum + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("CSV import error", e);
            errors.add("CSVの読み取りに失敗しました: " + e.getMessage());
        }

        // 「口座が見つからず主口座に登録」は警告扱い。成功件数には数えるため errorCount からは除く。
        long warnings = errors.stream().filter(m -> m.contains("主口座に登録しました")).count();
        return ImportResultDto.builder()
                .totalRows(totalRows)
                .successCount(createdIds.size())
                .errorCount((int) (errors.size() - warnings))
                .errors(errors)
                .createdEntryIds(createdIds)
                .build();
    }

    /** CSVの指定カラムの値を安全に取得する。カラムが存在しない場合は空文字を返す。 */
    private String getCol(List<String> cols, Map<String, Integer> colMap, String colName) {
        Integer idx = colMap.get(colName);
        if (idx == null || idx >= cols.size()) return "";
        return cols.get(idx);
    }

    /**
     * 1行の CSV を引用符対応で分割する（RFC4180 準拠。ダブルクォート内のカンマ・"" エスケープに対応）。
     * ※フィールド内の改行（複数行にまたがる引用フィールド）は非対応。
     */
    private List<String> parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                fields.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        fields.add(cur.toString());
        return fields;
    }

    /** 先頭の UTF-8 BOM (U+FEFF) を除去する。 */
    private String stripBom(String s) {
        return (s != null && !s.isEmpty() && s.charAt(0) == 0xFEFF) ? s.substring(1) : s;
    }

    /** 真偽値の緩い判定（1/true/yes/y/除外 を true とみなす）。 */
    private boolean isTruthy(String s) {
        if (s == null) return false;
        String v = s.trim().toLowerCase();
        return v.equals("1") || v.equals("true") || v.equals("yes") || v.equals("y") || v.equals("除外");
    }

    // ===========================================
    // Markdown パーサー（YAML フロントマッター対応）
    // ===========================================
    private ImportResultDto importMarkdown(User user, String content) {
        List<String> errors = new ArrayList<>();
        List<Long> createdIds = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String line;
            boolean inFrontMatter = false;
            Map<String, String> frontMatter = new HashMap<>();
            List<String> bodyLines = new ArrayList<>();
            boolean frontMatterDone = false;

            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();

                if (trimmed.equals("---")) {
                    if (!inFrontMatter && !frontMatterDone) {
                        inFrontMatter = true;
                        continue;
                    } else if (inFrontMatter) {
                        inFrontMatter = false;
                        frontMatterDone = true;
                        continue;
                    }
                }

                if (inFrontMatter) {
                    // YAML 簡易パース: "key: value"
                    int colonIdx = trimmed.indexOf(':');
                    if (colonIdx > 0) {
                        String key = trimmed.substring(0, colonIdx).trim().toLowerCase();
                        String value = trimmed.substring(colonIdx + 1).trim();
                        frontMatter.put(key, value);
                    }
                } else if (frontMatterDone) {
                    bodyLines.add(trimmed);
                }
            }

            if (frontMatter.isEmpty()) {
                return ImportResultDto.builder()
                        .totalRows(0).successCount(0).errorCount(1)
                        .errors(List.of("Markdownのフロントマッター（---で囲まれた部分）が見つかりません"))
                        .createdEntryIds(List.of())
                        .build();
            }

            // 日付
            String dateStr = frontMatter.getOrDefault("date", "");
            if (dateStr.isEmpty()) {
                return ImportResultDto.builder()
                        .totalRows(1).successCount(0).errorCount(1)
                        .errors(List.of("フロントマッターに date が指定されていません"))
                        .createdEntryIds(List.of())
                        .build();
            }
            LocalDate date;
            try {
                date = LocalDate.parse(dateStr);
            } catch (DateTimeParseException e) {
                return ImportResultDto.builder()
                        .totalRows(1).successCount(0).errorCount(1)
                        .errors(List.of("date の形式が不正です: " + dateStr))
                        .createdEntryIds(List.of())
                        .build();
            }

            // 金額（total）
            String totalStr = frontMatter.getOrDefault("total", "");
            if (totalStr.isEmpty()) {
                return ImportResultDto.builder()
                        .totalRows(1).successCount(0).errorCount(1)
                        .errors(List.of("フロントマッターに total が指定されていません"))
                        .createdEntryIds(List.of())
                        .build();
            }
            BigDecimal amount;
            try {
                amount = new BigDecimal(totalStr.replace(",", ""));
            } catch (NumberFormatException e) {
                return ImportResultDto.builder()
                        .totalRows(1).successCount(0).errorCount(1)
                        .errors(List.of("total が数値ではありません: " + totalStr))
                        .createdEntryIds(List.of())
                        .build();
            }

            // 店舗
            String storeName = frontMatter.getOrDefault("store", "");
            Store store = null;
            if (!storeName.isEmpty()) {
                store = getOrCreateStore(user, storeName, null);
            }

            // カテゴリ（type フィールドからカテゴリに変換）
            String categoryHint = frontMatter.getOrDefault("type", frontMatter.getOrDefault("category", ""));
            String categoryName = mapMarkdownTypeToCategory(categoryHint);
            Category category = getOrCreateCategory(user, categoryName, EntryType.EXPENSE);

            // メモ: 本文のリスト行を結合
            StringBuilder memo = new StringBuilder();
            for (String bodyLine : bodyLines) {
                if (bodyLine.startsWith("- ") || bodyLine.startsWith("* ")) {
                    if (memo.length() > 0) memo.append(", ");
                    memo.append(bodyLine.substring(2).trim());
                } else if (!bodyLine.isEmpty()) {
                    if (memo.length() > 0) memo.append(", ");
                    memo.append(bodyLine);
                }
            }

            Entry entry = new Entry();
            entry.setUser(user);
            entry.setEntryDate(date);
            entry.setAmount(amount);
            entry.setCategory(category);
            entry.setStore(store);
            entry.setType(EntryType.EXPENSE);
            entry.setMemo(memo.length() > 0 ? memo.toString() : null);

            Entry saved = entryRepository.save(entry);
            createdIds.add(saved.getId());

        } catch (Exception e) {
            log.error("Markdown import error", e);
            errors.add("Markdownの読み取りに失敗しました: " + e.getMessage());
        }

        return ImportResultDto.builder()
                .totalRows(1)
                .successCount(createdIds.size())
                .errorCount(errors.size())
                .errors(errors)
                .createdEntryIds(createdIds)
                .build();
    }

    /**
     * Markdown の type フィールドをカテゴリ名にマッピングする。
     * 未知の type はそのまま使い、空の場合は「その他」を返す。
     */
    private String mapMarkdownTypeToCategory(String type) {
        if (type == null || type.isEmpty()) return "その他";
        return switch (type.toLowerCase()) {
            case "grocery", "groceries", "food" -> "食費";
            case "transport", "transportation" -> "交通費";
            case "entertainment", "fun" -> "娯楽費";
            case "daily", "household" -> "日用品";
            case "social" -> "交際費";
            case "communication", "telecom" -> "通信費";
            default -> type;  // そのままカテゴリ名として使用
        };
    }

    // ===========================================
    // カテゴリ・店舗の取得 or 自動作成
    // ===========================================
    private Category getOrCreateCategory(User user, String name, EntryType type) {
        return categoryRepository.findByUserAndName(user, name)
                .orElseGet(() -> {
                    Category c = new Category();
                    c.setUser(user);
                    c.setName(name);
                    c.setType(type); // NOT NULL。旧スキーマのDB既定に依存せず明示的に設定する。
                    return categoryRepository.save(c);
                });
    }

    private Store getOrCreateStore(User user, String name, String type) {
        return storeRepository.findByUserAndName(user, name)
                .orElseGet(() -> {
                    Store s = new Store();
                    s.setUser(user);
                    s.setName(name);
                    s.setType(type);
                    return storeRepository.save(s);
                });
    }
}
