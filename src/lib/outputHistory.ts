const STORAGE_KEY = "travel-expense-output-history-v1";
const MAX_ENTRIES = 30;

/** 出力（Excel生成）の簡易履歴。ブラウザ内 localStorage のみ、サーバには送らない */
export interface OutputHistoryEntry {
  at: number; // 生成した時刻（ミリ秒）
  periodLabel: string; // 期間（例: 6/12〜6/20）
  amount: number; // 合計金額
  count: number; // 件数
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
