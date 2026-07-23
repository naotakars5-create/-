import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface GoogleDirectionsResponse {
  status: string;
  routes: Array<{
    fare?: { currency: string; value: number; text: string };
  }>;
}

/** 駅名の曖昧さを減らすため、末尾に「駅」が無ければ補う */
function toStationQuery(name: string): string {
  const trimmed = name.trim();
  return trimmed.endsWith("駅") ? trimmed : `${trimmed}駅`;
}

/**
 * Google Maps Directions API (mode=transit) で片道運賃を取得する。
 * 運賃マスタ（fareMaster.json）にヒットしない区間の補完として使う。
 * 見つからない・エラー時は null を返し、呼び出し元は手入力にフォールバックする
 * （精算金額に関わるため、失敗時に推測値を出さない）。
 */
async function fetchOneWayFare(from: string, to: string): Promise<number | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    origin: toStationQuery(from),
    destination: toStationQuery(to),
    mode: "transit",
    language: "ja",
    region: "jp",
    departure_time: "now",
    key: apiKey,
  });

  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
  if (!res.ok) return null;

  const data = (await res.json()) as GoogleDirectionsResponse;
  if (data.status !== "OK") return null;

  const fareValue = data.routes[0]?.fare?.value;
  if (typeof fareValue !== "number" || !Number.isFinite(fareValue)) return null;

  return Math.round(fareValue);
}

export async function POST(request: Request) {
  let body: { from?: string; to?: string; roundTrip?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { from, to, roundTrip } = body;
  if (!from || !to) {
    return NextResponse.json({ error: "from / to が必要です" }, { status: 400 });
  }

  try {
    const oneWay = await fetchOneWayFare(from, to);
    if (oneWay == null) {
      return NextResponse.json({ fare: null });
    }
    const fare = roundTrip ? oneWay * 2 : oneWay;
    return NextResponse.json({ fare });
  } catch {
    // 運賃検索の失敗はアプリ全体を止めない。呼び出し元は手入力にフォールバックする。
    return NextResponse.json({ fare: null });
  }
}
