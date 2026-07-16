package com.study.kakeibo.service.impl;

import com.study.kakeibo.dto.Response.ImportPreviewDto;
import com.study.kakeibo.dto.Response.ImportResultDto;
import com.study.kakeibo.dto.Response.ImportRowDto;
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

/**
 * CSV / Markdown からの取り込み。
 * 「解析（副作用なし）」と「永続化」を分離しており、
 * preview() は保存せず解析結果だけを返し、importData() は解析結果の非エラー行のみ保存する。
 */
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

    // ===========================================
    // プレビュー（保存しない）
    // ===========================================
    @Override
    @Transactional(readOnly = true)
    public ImportPreviewDto preview(Long userId, String format, String content) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        ParseOutcome outcome = parse(user, format, content);

        List<ImportRowDto> rows = new ArrayList<>();
        int ok = 0, warn = 0, err = 0;
        for (Parsed p : outcome.rows()) {
            rows.add(toDto(p));
            switch (p.status) {
                case "OK" -> ok++;
                case "WARNING" -> warn++;
                default -> err++;
            }
        }
        return ImportPreviewDto.builder()
                .totalRows(outcome.rows().size())
                .okCount(ok).warningCount(warn).errorCount(err)
                .headerError(outcome.headerError())
                .rows(rows)
                .build();
    }

    // ===========================================
    // 取り込み（非エラー行のみ保存）
    // ===========================================
    @Override
    @Transactional
    public ImportResultDto importData(Long userId, String format, String content) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));
        ParseOutcome outcome = parse(user, format, content);

        if (outcome.headerError() != null) {
            return ImportResultDto.builder()
                    .totalRows(0).successCount(0).errorCount(1)
                    .errors(List.of(outcome.headerError()))
                    .createdEntryIds(List.of())
                    .build();
        }

        List<String> messages = new ArrayList<>();
        List<Long> createdIds = new ArrayList<>();
        int errorCount = 0;

        for (Parsed p : outcome.rows()) {
            if (p.message != null) {
                messages.add("行" + p.line + ": " + p.message);
            }
            if (!p.importable()) {
                errorCount++;
                continue;
            }
            Category category = getOrCreateCategory(user, p.category, p.type);
            Store store = (p.store == null || p.store.isEmpty()) ? null : getOrCreateStore(user, p.store, null);

            Entry entry = new Entry();
            entry.setUser(user);
            entry.setEntryDate(p.date);
            entry.setAmount(p.amount);
            entry.setCategory(category);
            entry.setStore(store);
            entry.setType(p.type);
            entry.setMemo(p.memo);
            entry.setNote(p.note);
            entry.setFundPoolId(p.poolId);
            entry.setExcludeFromSimulation(p.excludeFromSimulation);

            createdIds.add(entryRepository.save(entry).getId());
        }

        return ImportResultDto.builder()
                .totalRows(outcome.rows().size())
                .successCount(createdIds.size())
                .errorCount(errorCount)
                .errors(messages)
                .createdEntryIds(createdIds)
                .build();
    }

    private ParseOutcome parse(User user, String format, String content) {
        if ("csv".equalsIgnoreCase(format)) {
            return parseCsv(user, content);
        } else if ("markdown".equalsIgnoreCase(format)) {
            return parseMarkdown(user, content);
        }
        throw new IllegalArgumentException("サポートされていないフォーマットです: " + format + "（csv または markdown を指定してください）");
    }

    // ===========================================
    // 解析結果の内部表現
    // ===========================================
    /** headerError != null なら致命的エラー（rows は空）。それ以外は rows に行ごとの解析結果。 */
    private record ParseOutcome(String headerError, List<Parsed> rows) {
    }

    /** 1行の解析結果（保存前の値と状態）。 */
    private static final class Parsed {
        int line;
        String status = "OK"; // OK | WARNING | ERROR
        String message;
        String rawDate;
        LocalDate date;
        BigDecimal amount;
        EntryType type = EntryType.EXPENSE;
        String category;
        boolean newCategory;
        String store;
        boolean newStore;
        String memo;
        String note;
        Long poolId;
        String poolDisplay = "主口座";
        boolean excludeFromSimulation;

        boolean importable() {
            return !"ERROR".equals(status);
        }
    }

    private void setError(Parsed p, String msg) {
        if (!"ERROR".equals(p.status)) { // 最初のエラーを優先
            p.status = "ERROR";
            p.message = msg;
        }
    }

    private void setWarning(Parsed p, String msg) {
        if ("OK".equals(p.status)) {
            p.status = "WARNING";
            p.message = msg;
        }
    }

    // ===========================================
    // CSV パーサー（保存しない）
    // ===========================================
    private ParseOutcome parseCsv(User user, String content) {
        List<Parsed> rows = new ArrayList<>();

        // 参照解決用の事前ロード（読み取りのみ）
        Map<String, Long> poolByName = new HashMap<>();
        for (FundPool p : fundPoolRepository.findByUserIdOrderBySortOrderAscIdAsc(user.getId())) {
            poolByName.put(p.getName().trim().toLowerCase(), p.getId());
        }
        Set<String> seenCatKeys = new HashSet<>();
        for (Category c : categoryRepository.findByUser(user)) {
            seenCatKeys.add(catKey(c.getName(), c.getType()));
        }
        Set<String> seenStores = new HashSet<>();
        for (Store s : storeRepository.findByUser(user)) {
            seenStores.add(s.getName().trim().toLowerCase());
        }

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                return new ParseOutcome("CSVが空です", rows);
            }
            headerLine = stripBom(headerLine); // Excel等のBOM除去

            List<String> headers = parseCsvLine(headerLine);
            Map<String, Integer> colMap = new HashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                colMap.put(headers.get(i).trim(), i);
            }
            if (!colMap.containsKey("日付") || !colMap.containsKey("金額")) {
                return new ParseOutcome("必須カラム「日付」と「金額」がヘッダーに見つかりません。"
                        + "認識する列: 日付,金額,カテゴリ,店舗,メモ,タイプ,口座,備考,除外", rows);
            }

            String line;
            int lineNum = 1;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.isBlank()) continue;

                List<String> cols = parseCsvLine(line);
                Parsed p = new Parsed();
                p.line = lineNum;

                // 日付
                p.rawDate = getCol(cols, colMap, "日付").trim();
                try {
                    p.date = LocalDate.parse(p.rawDate);
                } catch (DateTimeParseException e) {
                    setError(p, "日付の形式が不正です（yyyy-MM-dd）: " + p.rawDate);
                }

                // 金額（桁区切りカンマは許容）
                String amountStr = getCol(cols, colMap, "金額").trim().replace(",", "");
                try {
                    p.amount = new BigDecimal(amountStr);
                    if (p.amount.signum() <= 0) {
                        setError(p, "金額は0より大きい必要があります: " + amountStr);
                    }
                } catch (NumberFormatException e) {
                    setError(p, "金額が数値ではありません: " + amountStr);
                }

                // タイプ（INCOME/収入 のみ収入）
                String typeStr = getCol(cols, colMap, "タイプ").trim();
                p.type = ("INCOME".equalsIgnoreCase(typeStr) || "収入".equals(typeStr))
                        ? EntryType.INCOME : EntryType.EXPENSE;

                // カテゴリ（区分は収支タイプに合わせる。新規判定つき）
                String categoryName = getCol(cols, colMap, "カテゴリ").trim();
                if (categoryName.isEmpty()) categoryName = "その他";
                p.category = categoryName;
                markNewCategory(p, seenCatKeys);

                // 店舗（任意・新規判定つき）
                String storeName = getCol(cols, colMap, "店舗").trim();
                if (!storeName.isEmpty()) {
                    p.store = storeName;
                    markNewStore(p, seenStores);
                }

                // メモ（品名）・備考（自由メモ, note）
                p.memo = emptyToNull(getCol(cols, colMap, "メモ").trim());
                String note = getCol(cols, colMap, "備考").trim();
                if (note.isEmpty()) note = getCol(cols, colMap, "note").trim();
                p.note = emptyToNull(note);

                // 口座（既存名に一致すれば紐づけ、未指定/不一致は主口座）
                String poolName = getCol(cols, colMap, "口座").trim();
                if (!poolName.isEmpty()) {
                    Long id = poolByName.get(poolName.toLowerCase());
                    if (id != null) {
                        p.poolId = id;
                        p.poolDisplay = poolName;
                    } else {
                        p.poolDisplay = "主口座（未検出: " + poolName + "）";
                        setWarning(p, "口座「" + poolName + "」が見つからないため主口座に登録します");
                    }
                }

                // シミュレーション除外
                p.excludeFromSimulation = isTruthy(getCol(cols, colMap, "除外").trim());

                rows.add(p);
            }
        } catch (Exception e) {
            log.error("CSV parse error", e);
            return new ParseOutcome("CSVの読み取りに失敗しました: " + e.getMessage(), rows);
        }

        return new ParseOutcome(null, rows);
    }

    // ===========================================
    // Markdown パーサー（YAML フロントマッター対応・保存しない）
    // ===========================================
    private ParseOutcome parseMarkdown(User user, String content) {
        List<Parsed> rows = new ArrayList<>();

        Set<String> seenCatKeys = new HashSet<>();
        for (Category c : categoryRepository.findByUser(user)) {
            seenCatKeys.add(catKey(c.getName(), c.getType()));
        }
        Set<String> seenStores = new HashSet<>();
        for (Store s : storeRepository.findByUser(user)) {
            seenStores.add(s.getName().trim().toLowerCase());
        }

        Map<String, String> frontMatter = new HashMap<>();
        List<String> bodyLines = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String line;
            boolean inFrontMatter = false;
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
                    int colonIdx = trimmed.indexOf(':');
                    if (colonIdx > 0) {
                        frontMatter.put(trimmed.substring(0, colonIdx).trim().toLowerCase(),
                                trimmed.substring(colonIdx + 1).trim());
                    }
                } else if (frontMatterDone) {
                    bodyLines.add(trimmed);
                }
            }
        } catch (Exception e) {
            log.error("Markdown parse error", e);
            return new ParseOutcome("Markdownの読み取りに失敗しました: " + e.getMessage(), rows);
        }

        if (frontMatter.isEmpty()) {
            return new ParseOutcome("Markdownのフロントマッター（---で囲まれた部分）が見つかりません", rows);
        }

        Parsed p = new Parsed();
        p.line = 1;
        p.type = EntryType.EXPENSE;

        // 日付
        p.rawDate = frontMatter.getOrDefault("date", "");
        if (p.rawDate.isEmpty()) {
            setError(p, "フロントマッターに date が指定されていません");
        } else {
            try {
                p.date = LocalDate.parse(p.rawDate);
            } catch (DateTimeParseException e) {
                setError(p, "date の形式が不正です: " + p.rawDate);
            }
        }

        // 金額（total）
        String totalStr = frontMatter.getOrDefault("total", "");
        if (totalStr.isEmpty()) {
            setError(p, "フロントマッターに total が指定されていません");
        } else {
            try {
                p.amount = new BigDecimal(totalStr.replace(",", ""));
                if (p.amount.signum() <= 0) setError(p, "total は0より大きい必要があります: " + totalStr);
            } catch (NumberFormatException e) {
                setError(p, "total が数値ではありません: " + totalStr);
            }
        }

        // カテゴリ（type フィールドから変換）
        String categoryHint = frontMatter.getOrDefault("type", frontMatter.getOrDefault("category", ""));
        p.category = mapMarkdownTypeToCategory(categoryHint);
        markNewCategory(p, seenCatKeys);

        // 店舗
        String storeName = frontMatter.getOrDefault("store", "");
        if (!storeName.isEmpty()) {
            p.store = storeName;
            markNewStore(p, seenStores);
        }

        // メモ: 本文のリスト行を結合
        StringBuilder memo = new StringBuilder();
        for (String bodyLine : bodyLines) {
            String text = (bodyLine.startsWith("- ") || bodyLine.startsWith("* "))
                    ? bodyLine.substring(2).trim() : bodyLine;
            if (text.isEmpty()) continue;
            if (memo.length() > 0) memo.append(", ");
            memo.append(text);
        }
        p.memo = memo.length() > 0 ? memo.toString() : null;

        rows.add(p);
        return new ParseOutcome(null, rows);
    }

    // ===========================================
    // ヘルパー
    // ===========================================
    private String catKey(String name, EntryType type) {
        return name.trim().toLowerCase() + "|" + type.name();
    }

    /** 取り込み時に新規作成されるカテゴリか判定し、以降は既知として扱う。ERROR 行は対象外。 */
    private void markNewCategory(Parsed p, Set<String> seenCatKeys) {
        if (!p.importable()) return;
        String key = catKey(p.category, p.type);
        if (!seenCatKeys.contains(key)) {
            p.newCategory = true;
            seenCatKeys.add(key);
        }
    }

    private void markNewStore(Parsed p, Set<String> seenStores) {
        if (!p.importable() || p.store == null) return;
        String key = p.store.trim().toLowerCase();
        if (!seenStores.contains(key)) {
            p.newStore = true;
            seenStores.add(key);
        }
    }

    private ImportRowDto toDto(Parsed p) {
        return ImportRowDto.builder()
                .line(p.line)
                .status(p.status)
                .message(p.message)
                .date(p.rawDate)
                .amount(p.amount)
                .type(p.type != null ? p.type.name() : null)
                .category(p.category)
                .newCategory(p.newCategory)
                .store(p.store)
                .newStore(p.newStore)
                .memo(p.memo)
                .note(p.note)
                .pool(p.poolDisplay)
                .excludeFromSimulation(p.excludeFromSimulation)
                .build();
    }

    private String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    /** CSVの指定カラムの値を安全に取得する。カラムが無い場合は空文字。 */
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
            default -> type;
        };
    }

    // ===========================================
    // カテゴリ・店舗の取得 or 自動作成（永続化時のみ使用）
    // ===========================================
    private Category getOrCreateCategory(User user, String name, EntryType type) {
        return categoryRepository.findByUserAndName(user, name)
                .orElseGet(() -> {
                    Category c = new Category();
                    c.setUser(user);
                    c.setName(name);
                    c.setType(type); // NOT NULL。DB既定に依存せず明示設定。
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
