import { emptyLeg } from "./fare";
import type { RouteLeg, Trip } from "./types";

const STORAGE_KEY = "travel-expense-history-v1";
const MAX_ENTRIES = 50;

/** 出張パターンの履歴（日付・IDを除いた、繰り返し使える項目のみ） */
export type TripHistoryEntry = Omit<Trip, "id" | "month" | "day"> & {
  lastUsedAt: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** 旧形式の経路文字列（例: 千葉-鎌ケ谷大仏(往復)）を1区間に変換する */
function parseLegFromString(route: string, fare: number | null): RouteLeg {
  let s = route.trim();
  let roundTrip = false;
  const m = s.match(/[(（]\s*往復\s*[)）]\s*$/);
  if (m && m.index != null) {
    roundTrip = true;
    s = s.slice(0, m.index).trim();
  }
  // ハイフン類（-, −, –, —, 〜, ~）を区切りとして最初の1つで分割
  const idx = s.search(/[-−–—〜~]/);
  const from = idx >= 0 ? s.slice(0, idx).trim() : s;
  const to = idx >= 0 ? s.slice(idx + 1).trim() : "";
  return { from, to, roundTrip, fare };
}

/**
 * 保存済みエントリを現行の型に正規化する。
 * 旧形式（route 文字列・fare・taxiCompany 等を持ち routes が無い）でも
 * クラッシュせずに読めるよう移行する。
 */
function migrateEntry(e: unknown): TripHistoryEntry | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const numOr = (v: unknown, d: number): number => (typeof v === "number" ? v : d);
  const fareOf = (v: unknown): number | null => (typeof v === "number" ? v : null);

  // 経路: 現行の routes 配列があれば各区間を補完、無ければ旧 route 文字列から生成
  let routes: RouteLeg[];
  if (Array.isArray(o.routes)) {
    routes = (o.routes as unknown[]).map((l) => {
      const leg = (l ?? {}) as Record<string, unknown>;
      return {
        from: str(leg.from),
        to: str(leg.to),
        roundTrip: leg.roundTrip === true,
        fare: fareOf(leg.fare),
      };
    });
  } else if (str(o.route).trim() !== "") {
    routes = [parseLegFromString(str(o.route), fareOf(o.fare))];
  } else {
    routes = [emptyLeg()];
  }
  if (routes.length === 0) routes = [emptyLeg()];

  return {
    destination: str(o.destination),
    visitTo: str(o.visitTo),
    purpose: str(o.purpose),
    routes,
    tollParking: numOr(o.tollParking, 0),
    // 旧: L列の利用会社は taxiCompany（無ければ transitCompany）に入っていた
    tollParkingCompany: str(o.tollParkingCompany) || str(o.taxiCompany) || str(o.transitCompany),
    taxi: numOr(o.taxi, 0),
    payAllowance: o.payAllowance === true,
    allowance: numOr(o.allowance, 0),
    lastUsedAt: numOr(o.lastUsedAt, 0),
  };
}

/** 履歴一覧を読み込む（新しく使ったもの順）。ブラウザ内 localStorage のみ、サーバには送らない */
export function loadHistory(): TripHistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(migrateEntry)
      .filter((e): e is TripHistoryEntry => e !== null);
  } catch {
    return [];
  }
}

/** 経路を文字列化する（キー生成用） */
function routesToKey(routes: Trip["routes"]): string {
  return (routes ?? [])
    .map((l) => `${l.from.trim()}>${l.to.trim()}${l.roundTrip ? "(往復)" : ""}`)
    .join(",");
}

/** 出張パターンを識別するキー（同じ行き先・訪問先・用務・経路なら同一パターンとみなす） */
function historyKey(
  t: Pick<Trip, "destination" | "visitTo" | "purpose" | "routes">
): string {
  return [t.destination.trim(), t.visitTo.trim(), t.purpose.trim(), routesToKey(t.routes)].join(
    " | "
  );
}

/**
 * 確定した出張を履歴に記録する（新しい順、同一パターンは上書きして先頭へ）。
 * 最大 MAX_ENTRIES 件まで保持する。
 */
export function recordHistory(trips: Trip[]): void {
  if (!isBrowser() || trips.length === 0) return;
  const current = loadHistory();
  const byKey = new Map(current.map((e) => [historyKey(e), e]));

  for (const t of trips) {
    if (!t.destination && !t.visitTo) continue; // 空データは記録しない
    const { id: _id, month: _month, day: _day, ...rest } = t;
    byKey.set(historyKey(t), { ...rest, lastUsedAt: Date.now() });
  }

  const next = [...byKey.values()]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 保存失敗（容量超過など）は致命的ではないため無視する
  }
}

/**
 * 履歴から1件を削除する（間違えて登録したパターンを消す用）。
 * 指定エントリと同一パターン（行き先・訪問先・用務・経路が一致）を取り除いて
 * 保存し、更新後の一覧を返す。
 */
export function removeHistory(entry: TripHistoryEntry): TripHistoryEntry[] {
  if (!isBrowser()) return [];
  const key = historyKey(entry);
  const next = loadHistory().filter((e) => historyKey(e) !== key);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 保存失敗は致命的ではないため無視する
  }
  return next;
}

/** 履歴エントリから、今日の日付を持つ新しい下書き Trip を作る（経路はディープコピー） */
export function tripFromHistory(entry: TripHistoryEntry, newId: string): Trip {
  const now = new Date();
  const { lastUsedAt: _lastUsedAt, ...rest } = entry;
  return {
    ...rest,
    routes: (entry.routes ?? [emptyLeg()]).map((l) => ({ ...l })),
    id: newId,
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

/** 履歴からユニークな文字列値の一覧を集める（入力欄のオートコンプリート用） */
export function uniqueValues(
  history: TripHistoryEntry[],
  key: keyof TripHistoryEntry
): string[] {
  const set = new Set<string>();
  for (const e of history) {
    const v = e[key];
    if (typeof v === "string" && v.trim() !== "") set.add(v);
  }
  return [...set];
}

/** 履歴中の全経路から、駅名のユニーク一覧を集める（駅名欄のオートコンプリート用） */
export function uniqueStations(history: TripHistoryEntry[]): string[] {
  const set = new Set<string>();
  for (const e of history) {
    for (const l of e.routes ?? []) {
      if (l.from.trim()) set.add(l.from.trim());
      if (l.to.trim()) set.add(l.to.trim());
    }
  }
  return [...set];
}
