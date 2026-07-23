import fareMaster from "./fareMaster.json";

interface FareEntry {
  from: string;
  to: string;
  oneWay: number;
  roundTrip: number;
}

const master: FareEntry[] = fareMaster as FareEntry[];

/**
 * 運賃マスタから運賃を引く。ヒットしなければ null（UI 側で手入力させる）。
 * 将来 API 連携に差し替える場合もこのシグネチャを維持する。
 */
export function getFare(from: string, to: string, roundTrip: boolean): number | null {
  const hit = master.find(
    (e) =>
      (e.from === from && e.to === to) ||
      (e.from === to && e.to === from)
  );
  if (!hit) return null;
  return roundTrip ? hit.roundTrip : hit.oneWay;
}

/** 経路文字列を組み立てる（例: 千葉-鎌ケ谷大仏(往復)） */
export function buildRoute(from: string, to: string, roundTrip: boolean): string {
  if (!from && !to) return "";
  return `${from}-${to}${roundTrip ? "(往復)" : ""}`;
}
