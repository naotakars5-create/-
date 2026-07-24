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

/**
 * 出力履歴を年ごとに集計して累計を返す（新しい年が上）。
 * 年は 対象年 を優先し、無ければ出力した日の年で補う。
 */
export function cumulativeByYear(entries: OutputHistoryEntry[]): YearCumulative[] {
  const map = new Map<number, { amount: number; count: number }>();
  for (const e of entries) {
    const year = e.year ?? e.request?.year ?? new Date(e.at).getFullYear();
    const cur = map.get(year) ?? { amount: 0, count: 0 };
    cur.amount += e.amount;
    cur.count += e.count;
    map.set(year, cur);
  }
  return [...map.entries()]
    .map(([year, v]) => ({ year, amount: v.amount, count: v.count }))
    .sort((a, b) => b.year - a.year);
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
