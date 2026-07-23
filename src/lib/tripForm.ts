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
