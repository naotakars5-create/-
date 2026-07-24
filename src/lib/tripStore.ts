import { emptyLeg } from "./fare";
import type { RouteLeg, Trip } from "./types";

const STORAGE_KEY = "travel-expense-trips-v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const numOr = (v: unknown, d: number): number => (typeof v === "number" ? v : d);
const fareOf = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** 保存済みの1件を現行の Trip 型に正規化する（壊れたデータでも落ちないように） */
function sanitizeTrip(e: unknown): Trip | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id === "") return null;

  let routes: RouteLeg[] = Array.isArray(o.routes)
    ? (o.routes as unknown[]).map((l) => {
        const leg = (l ?? {}) as Record<string, unknown>;
        return {
          from: str(leg.from),
          to: str(leg.to),
          roundTrip: leg.roundTrip === true,
          fare: fareOf(leg.fare),
        };
      })
    : [];
  if (routes.length === 0) routes = [emptyLeg()];

  return {
    id: o.id,
    month: numOr(o.month, 1),
    day: numOr(o.day, 1),
    destination: str(o.destination),
    visitTo: str(o.visitTo),
    purpose: str(o.purpose),
    routes,
    carDistanceKm: numOr(o.carDistanceKm, 0),
    carUnitPrice: numOr(o.carUnitPrice, 0),
    tollParking: numOr(o.tollParking, 0),
    tollParkingCompany: str(o.tollParkingCompany),
    taxi: numOr(o.taxi, 0),
    payAllowance: o.payAllowance === true,
    allowance: numOr(o.allowance, 0),
  };
}

/** 一覧（登録済み出張）と出力対象の選択を読み込む。ブラウザ内 localStorage のみ */
export function loadTripsState(): { trips: Trip[]; selectedIds: string[] } {
  if (!isBrowser()) return { trips: [], selectedIds: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { trips: [], selectedIds: [] };
    const parsed = JSON.parse(raw);
    const trips = Array.isArray(parsed?.trips)
      ? parsed.trips.map(sanitizeTrip).filter((t: Trip | null): t is Trip => t !== null)
      : [];
    const ids = new Set(trips.map((t: Trip) => t.id));
    const selectedIds = Array.isArray(parsed?.selectedIds)
      ? parsed.selectedIds.filter((id: unknown): id is string => typeof id === "string" && ids.has(id))
      : [];
    return { trips, selectedIds };
  } catch {
    return { trips: [], selectedIds: [] };
  }
}

/** 一覧と選択を保存する。ブラウザ内のみ、サーバには送らない */
export function saveTripsState(trips: Trip[], selectedIds: string[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips, selectedIds }));
  } catch {
    // 保存失敗（容量超過など）は致命的ではないため無視する
  }
}
