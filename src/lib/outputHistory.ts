import { tripTotal } from "./tripForm";
import type { GenerateRequest } from "./types";

const STORAGE_KEY = "travel-expense-output-history-v1";
const MAX_ENTRIES = 30;

/** 出力（Excel生成）の簡易履歴。ブラウザ内 localStorage のみ、サーバには送らない */
export interface OutputHistoryEntry {
  at: number; // 生成した時刻（ミリ秒）
  periodLabel: string; // 期間（例: 6/12〜6/20）
  amount: number; // 合計金額
  count: number; // 件数
  year?: number; // 対象年（年ごとの累計に使う）。古い記録には無い場合がある
  months?: MonthCumulative[]; // 月ごとの内訳。古い記録には無い場合がある
  // 再出力用のスナップショット（この履歴をクリックすると同じ内容を再生成する）。
  // 古い記録には無い場合がある。
  request?: GenerateRequest;
}

/** 年ごとの累計（金額・件数） */
export interface YearCumulative {
  year: number;
  amount: number;
  count: number;
}

/** 月ごとの合計（金額・件数） */
export interface MonthCumulative {
  month: number; // 1-12
  amount: number;
  count: number;
}

/** 1件の出力の年（対象年優先、無ければ出力日の年） */
function entryYear(e: OutputHistoryEntry): number {
  return e.year ?? e.request?.year ?? new Date(e.at).getFullYear();
}

/** 1件の出力の月別内訳を返す（無ければ期間の先頭月に全額を割り当てる） */
function entryMonths(e: OutputHistoryEntry): MonthCumulative[] {
  if (e.months && e.months.length > 0) return e.months;
  const startMonth = parseInt(e.periodLabel, 10); // "6/12〜..." → 6
  if (Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12) {
    return [{ month: startMonth, amount: e.amount, count: e.count }];
  }
  return [];
}

interface Bucket {
  amount: number;
  count: number;
}

/**
 * 累計を「出張1件ごと（ID単位）」で重複を除いて集計する。
 * - スナップショット（request.trips）がある出力: 出張を ID で名寄せし、同じ ID は
 *   最新の出力の内容で1回だけ数える（同じ内容を出力し直しても二重にならない）。
 * - スナップショットが無い古い記録: ID で名寄せできないため、記録どおりの合算で加える。
 * 戻り値: 年ごと / 年+月ごと の集計。
 */
function computeCumulative(entries: OutputHistoryEntry[]): {
  byYear: Map<number, Bucket>;
  byYearMonth: Map<string, Bucket>;
} {
  const byYear = new Map<number, Bucket>();
  const byYearMonth = new Map<string, Bucket>();
  const add = (map: Map<string | number, Bucket>, key: string | number, amount: number, count: number) => {
    const cur = map.get(key) ?? { amount: 0, count: 0 };
    cur.amount += amount;
    cur.count += count;
    map.set(key, cur);
  };

  // 1) スナップショットがある出力 → 出張を ID で名寄せ（最新の出力を採用）
  const tripById = new Map<string, { year: number; month: number; amount: number; at: number }>();
  for (const e of entries) {
    const trips = e.request?.trips;
    if (!trips) continue;
    const year = entryYear(e);
    for (const t of trips) {
      const prev = tripById.get(t.id);
      if (!prev || e.at >= prev.at) {
        tripById.set(t.id, { year, month: t.month, amount: tripTotal(t), at: e.at });
      }
    }
  }
  for (const v of tripById.values()) {
    add(byYear as Map<string | number, Bucket>, v.year, v.amount, 1);
    add(byYearMonth as Map<string | number, Bucket>, `${v.year}-${v.month}`, v.amount, 1);
  }

  // 2) スナップショットが無い古い記録 → 記録どおりの合算（名寄せ不可）
  for (const e of entries) {
    if (e.request?.trips) continue;
    const year = entryYear(e);
    add(byYear as Map<string | number, Bucket>, year, e.amount, e.count);
    for (const m of entryMonths(e)) {
      add(byYearMonth as Map<string | number, Bucket>, `${year}-${m.month}`, m.amount, m.count);
    }
  }

  return { byYear, byYearMonth };
}

/** 年ごとの累計（新しい年が上）。同じ出張は ID 単位で1回だけ数える */
export function cumulativeByYear(entries: OutputHistoryEntry[]): YearCumulative[] {
  const { byYear } = computeCumulative(entries);
  return [...byYear.entries()]
    .map(([year, v]) => ({ year, amount: v.amount, count: v.count }))
    .sort((a, b) => b.year - a.year);
}

/** 指定した年の、月ごとの合計を返す（月の昇順）。同じ出張は ID 単位で1回だけ数える */
export function monthlyByYear(entries: OutputHistoryEntry[], year: number): MonthCumulative[] {
  const { byYearMonth } = computeCumulative(entries);
  const out: MonthCumulative[] = [];
  for (const [key, v] of byYearMonth.entries()) {
    const dash = key.indexOf("-");
    const y = Number(key.slice(0, dash));
    const m = Number(key.slice(dash + 1));
    if (y === year) out.push({ month: m, amount: v.amount, count: v.count });
  }
  return out.sort((a, b) => a.month - b.month);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** 出力履歴を読み込む（新しい順） */
export function loadOutputHistory(): OutputHistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OutputHistoryEntry =>
        e &&
        typeof e.at === "number" &&
        typeof e.periodLabel === "string" &&
        typeof e.amount === "number" &&
        typeof e.count === "number"
    );
  } catch {
    return [];
  }
}

/** 出力を1件記録して、更新後の一覧（新しい順）を返す */
export function recordOutput(entry: Omit<OutputHistoryEntry, "at">): OutputHistoryEntry[] {
  if (!isBrowser()) return [];
  const next = [{ ...entry, at: Date.now() }, ...loadOutputHistory()].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 保存失敗は致命的ではないため無視する
  }
  return next;
}

/** 出力履歴を1件だけ消す（新しい順の一覧での位置 index を指定）。更新後の一覧を返す */
export function removeOutputAt(index: number): OutputHistoryEntry[] {
  if (!isBrowser()) return [];
  const next = loadOutputHistory().filter((_, i) => i !== index);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 保存失敗は致命的ではないため無視する
  }
  return next;
}

/** 出力履歴をすべて消す */
export function clearOutputHistory(): OutputHistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
  return [];
}
