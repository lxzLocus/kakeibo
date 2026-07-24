package com.study.kakeibo.service.benchmark;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 世帯平均との比較に使う参照データ（費目構成比＝消費支出に占める各費目の割合 %）。
 *
 * 出典イメージ: 総務省統計局「家計調査（家計収支編）」の 10大費目 構成比。
 * ここに入っている数値は概算の参考値であり、正確な公表値に差し替え可能な構造にしている
 * （このクラスの定数を書き換えるだけでよい）。合計は概ね100%だが、比較時に正規化するため
 * 端数は問題にならない。
 *
 * 軸は2つ:
 *  - 年代別（世帯区分 × 年代）
 *  - 収入帯別（世帯区分 × 手取り月収の帯）
 * 年齢ベースと収入ベースで内訳が大きく異なるため、両方を用意している。
 */
public final class HouseholdBenchmarkData {

    private HouseholdBenchmarkData() {
    }

    /** 10大費目（表示名。この順序で返す）。 */
    public static final List<String> CATEGORIES = List.of(
            "食料", "住居", "光熱・水道", "家具・家事用品", "被服及び履物",
            "保健医療", "交通・通信", "教育", "教養娯楽", "その他");

    public static final String SINGLE = "SINGLE"; // 単身世帯
    public static final String FAMILY = "FAMILY"; // 2人以上世帯

    /** 有効な年代キー（フロントの選択肢と一致）。テーブル初期化より前に定義する必要がある。 */
    public static final List<String> AGE_GROUPS = List.of("20代", "30代", "40代", "50代", "60代", "70代以上");

    /** 参照データの出典・注記（UI表示用）。 */
    public static final String SOURCE_NOTE = "参考値（総務省 家計調査ベース・概算）";

    // 費目の並びに対応する構成比（%）。CATEGORIES と同じ順序。
    // 食料, 住居, 光熱水道, 家具家事, 被服, 保健医療, 交通通信, 教育, 教養娯楽, その他

    // ---- 2人以上世帯：年代別 ----
    private static final Map<String, double[]> FAMILY_BY_AGE = ageMap(
            new double[]{26, 9, 7, 4, 5, 3, 16, 2, 10, 18},   // 20代
            new double[]{26, 8, 7, 5, 5, 4, 15, 5, 9, 16},    // 30代
            new double[]{25, 5, 7, 4, 4, 4, 15, 9, 9, 18},    // 40代
            new double[]{25, 5, 7, 4, 4, 5, 15, 5, 9, 21},    // 50代
            new double[]{27, 5, 8, 4, 4, 6, 14, 1, 10, 21},   // 60代
            new double[]{28, 5, 9, 4, 3, 7, 12, 0, 9, 23});   // 70代以上

    // ---- 2人以上世帯：収入帯別（手取り月収）----
    private static final Map<String, double[]> FAMILY_BY_INCOME = mapOf(
            "〜30万", new double[]{30, 7, 10, 4, 3, 6, 13, 3, 8, 16},
            "30〜40万", new double[]{28, 6, 9, 4, 4, 5, 14, 4, 9, 17},
            "40〜50万", new double[]{27, 6, 8, 4, 4, 5, 15, 4, 9, 18},
            "50〜60万", new double[]{25, 6, 7, 4, 4, 5, 15, 5, 10, 19},
            "60万〜", new double[]{23, 6, 6, 4, 4, 5, 16, 6, 10, 20});

    // ---- 単身世帯：年代別 ----
    private static final Map<String, double[]> SINGLE_BY_AGE = ageMap(
            new double[]{24, 16, 6, 3, 4, 3, 16, 0, 12, 16},  // 20代
            new double[]{25, 15, 6, 4, 3, 4, 16, 0, 11, 16},  // 30代
            new double[]{26, 13, 7, 4, 3, 4, 15, 0, 10, 18},  // 40代
            new double[]{26, 11, 7, 4, 3, 5, 15, 0, 10, 19},  // 50代
            new double[]{27, 10, 8, 4, 3, 6, 13, 0, 10, 19},  // 60代
            new double[]{28, 9, 9, 4, 3, 8, 11, 0, 9, 19});   // 70代以上

    // ---- 単身世帯：収入帯別（手取り月収）----
    private static final Map<String, double[]> SINGLE_BY_INCOME = mapOf(
            "〜15万", new double[]{28, 15, 8, 3, 3, 5, 13, 0, 9, 16},
            "15〜20万", new double[]{27, 14, 7, 4, 3, 5, 14, 0, 10, 16},
            "20〜30万", new double[]{26, 13, 7, 4, 3, 5, 15, 0, 10, 17},
            "30〜40万", new double[]{24, 12, 6, 4, 4, 4, 16, 0, 11, 19},
            "40万〜", new double[]{22, 11, 6, 4, 4, 4, 16, 0, 12, 21});

    // 収入帯の上限しきい値（手取り月収・円）。順に判定し、最後は上限なし。
    private static final long[] FAMILY_INCOME_LIMITS = {300_000, 400_000, 500_000, 600_000};
    private static final String[] FAMILY_INCOME_LABELS = {"〜30万", "30〜40万", "40〜50万", "50〜60万", "60万〜"};
    private static final long[] SINGLE_INCOME_LIMITS = {150_000, 200_000, 300_000, 400_000};
    private static final String[] SINGLE_INCOME_LABELS = {"〜15万", "15〜20万", "20〜30万", "30〜40万", "40万〜"};

    /** 年代別の平均構成比を返す。該当なしは null。 */
    public static double[] byAge(String household, String ageGroup) {
        if (ageGroup == null) return null;
        Map<String, double[]> m = FAMILY.equals(household) ? FAMILY_BY_AGE : SINGLE_BY_AGE;
        return m.get(ageGroup);
    }

    /** 手取り月収から収入帯ラベルを判定する。 */
    public static String incomeBandLabel(String household, long monthlyIncome) {
        boolean family = FAMILY.equals(household);
        long[] limits = family ? FAMILY_INCOME_LIMITS : SINGLE_INCOME_LIMITS;
        String[] labels = family ? FAMILY_INCOME_LABELS : SINGLE_INCOME_LABELS;
        for (int i = 0; i < limits.length; i++) {
            if (monthlyIncome < limits[i]) return labels[i];
        }
        return labels[labels.length - 1];
    }

    /** 収入帯別の平均構成比を返す。該当なしは null。 */
    public static double[] byIncome(String household, String bandLabel) {
        if (bandLabel == null) return null;
        Map<String, double[]> m = FAMILY.equals(household) ? FAMILY_BY_INCOME : SINGLE_BY_INCOME;
        return m.get(bandLabel);
    }

    /** 世帯区分の正規化（未知は単身）。 */
    public static String normalizeHousehold(String household) {
        return FAMILY.equalsIgnoreCase(household) ? FAMILY : SINGLE;
    }

    /**
     * ユーザーのカテゴリ名を 10大費目 のインデックス(0..9)へ寄せる（名前ヒューリスティック）。
     * どれにも当たらなければ「その他」(=9)。
     */
    public static int categoryIndex(String name) {
        if (name == null) return 9;
        String s = name.toLowerCase();
        // 判定は優先度順（「食」より先に「住居ローン」等を拾わないよう固有語を先に）
        if (containsAny(s, "家賃", "住居", "住宅", "管理費", "地代", "rent")) return 1;
        if (containsAny(s, "光熱", "水道", "電気", "電力", "ガス", "utility")) return 2;
        if (containsAny(s, "家具", "家事", "日用品", "雑貨", "消耗品")) return 3;
        if (containsAny(s, "被服", "衣", "服", "靴", "ファッション", "アパレル", "cloth")) return 4;
        if (containsAny(s, "医療", "病院", "薬", "保健", "健康", "ドラッグ", "health", "medical")) return 5;
        if (containsAny(s, "交通", "通信", "電車", "バス", "タクシー", "ガソリン", "定期",
                "携帯", "スマホ", "通話", "ネット", "wifi", "traffic", "transport")) return 6;
        if (containsAny(s, "教育", "学費", "塾", "習い事", "教材", "学校", "保育", "education")) return 7;
        if (containsAny(s, "娯楽", "趣味", "教養", "レジャー", "書籍", "本", "映画", "ゲーム",
                "旅行", "エンタメ", "サブスク", "音楽", "hobby", "game")) return 8;
        if (containsAny(s, "食", "飲食", "外食", "スーパー", "コンビニ", "カフェ", "ランチ",
                "ディナー", "grocery", "food")) return 0;
        return 9;
    }

    private static boolean containsAny(String s, String... keys) {
        for (String k : keys) {
            if (s.contains(k)) return true;
        }
        return false;
    }

    private static Map<String, double[]> ageMap(double[]... rows) {
        Map<String, double[]> m = new LinkedHashMap<>();
        for (int i = 0; i < AGE_GROUPS.size() && i < rows.length; i++) {
            m.put(AGE_GROUPS.get(i), rows[i]);
        }
        return m;
    }

    private static Map<String, double[]> mapOf(Object... kv) {
        Map<String, double[]> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put((String) kv[i], (double[]) kv[i + 1]);
        }
        return m;
    }
}
