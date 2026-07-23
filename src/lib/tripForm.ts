import { getAllowance, shouldPayAllowance } from "./allowance";
import { buildRoute, getFare } from "./fare";
import type { ExtractedTrip, Position, Trip } from "./types";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

/** 空の Trip を作る */
export function emptyTrip(): Trip {
  return {
    id: nextId(),
    month: new Date().getMonth() + 1,
    day: 1,
    destination: "",
    visitTo: "",
    purpose: "",
    route: "",
    fare: null,
    fareAuto: false,
    transitCompany: "",
    tollParking: 0,
    taxi: 0,
    taxiCompany: "",
    payAllowance: false,
    allowance: 0,
    lodging: 0,
  };
}

/**
 * 抽出結果 + 役職から Trip の下書きを作る。
 * 運賃はマスタから補完、日当は役職から補完（付与可否は shouldPayAllowance）。
 * 確認画面で自動確定せず、ユーザーが修正できる前提。
 */
export function draftFromExtracted(e: ExtractedTrip, position: Position): Trip {
  const from = e.routeFrom ?? "";
  const to = e.routeTo ?? "";
  const route = buildRoute(from, to, e.roundTrip);
  const fare = from && to ? getFare(from, to, e.roundTrip) : null;
  const allowance = getAllowance(position);
  const now = new Date();

  const base = {
    destination: e.destination ?? "",
    route,
    lodging: e.lodging,
  };

  return {
    id: nextId(),
    month: e.month ?? now.getMonth() + 1,
    day: e.day ?? 1,
    destination: e.destination ?? "",
    visitTo: e.visitTo ?? "",
    purpose: e.purpose ?? "",
    route,
    fare,
    fareAuto: false, // 運賃マスタからの補完は確度が高いため要確認扱いにしない
    transitCompany: e.transitCompany ?? "",
    tollParking: e.tollParking,
    taxi: e.taxi,
    taxiCompany: "",
    payAllowance: shouldPayAllowance(base),
    allowance,
    lodging: e.lodging,
  };
}

/** 1件の合計金額 */
export function tripTotal(t: Trip): number {
  return (
    (t.fare ?? 0) +
    t.tollParking +
    t.taxi +
    (t.payAllowance ? t.allowance : 0) +
    t.lodging
  );
}

/** 出張リストの合計金額 */
export function totalAmount(trips: Trip[]): number {
  return trips.reduce((s, t) => s + tripTotal(t), 0);
}
