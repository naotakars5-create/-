import { emptyLeg } from "./fare";
import type { Trip } from "./types";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

/** 空の Trip を作る（手入力の起点。日付はデフォルトで今日にしておく） */
export function emptyTrip(): Trip {
  const now = new Date();
  return {
    id: nextId(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    destination: "",
    visitTo: "",
    purpose: "",
    routes: [emptyLeg()],
    carDistanceKm: 0,
    carUnitPrice: 0,
    tollParking: 0,
    tollParkingCompany: "",
    taxi: 0,
    payAllowance: false,
    allowance: 0,
  };
}

/** 自家用車費（距離 × 単価、円・整数） */
export function carAmount(t: Pick<Trip, "carDistanceKm" | "carUnitPrice">): number {
  return Math.round((t.carDistanceKm || 0) * (t.carUnitPrice || 0));
}

/** 1区間の計上額（片道運賃。往復チェック時は2倍で計上する） */
export function legFare(leg: { fare: number | null; roundTrip: boolean }): number {
  return (leg.fare ?? 0) * (leg.roundTrip ? 2 : 1);
}

/** 合計金額の計算に必要な項目だけを持てばよい（Trip でも履歴エントリでも渡せる） */
type TripAmountFields = Pick<
  Trip,
  | "routes"
  | "carDistanceKm"
  | "carUnitPrice"
  | "tollParking"
  | "taxi"
  | "payAllowance"
  | "allowance"
>;

/** 経路（全区間）の運賃合計（往復は2倍で計上） */
export function routesFareTotal(t: Pick<Trip, "routes">): number {
  return t.routes.reduce((s, leg) => s + legFare(leg), 0);
}

/** 1件の合計金額（自家用車費も鉄道・バス運賃と同じ扱いで含める） */
export function tripTotal(t: TripAmountFields): number {
  return (
    routesFareTotal(t) +
    carAmount(t) +
    t.tollParking +
    t.taxi +
    (t.payAllowance ? t.allowance : 0)
  );
}

/** 出張リストの合計金額 */
export function totalAmount(trips: Trip[]): number {
  return trips.reduce((s, t) => s + tripTotal(t), 0);
}
