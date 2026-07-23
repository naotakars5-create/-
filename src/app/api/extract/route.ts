import OpenAI from "openai";
import { NextResponse } from "next/server";
import { EXTRACT_SYSTEM_PROMPT } from "@/lib/extractPrompt";
import type { ExtractedTrip } from "@/lib/types";

export const runtime = "nodejs";

/**
 * モデルの生テキストから { "trips": [...] } を取り出し、
 * 各要素を正規化した配列として返す（1件のみでも配列）。
 */
function parseExtractedList(text: string): ExtractedTrip[] {
  let raw = text.trim();
  // 念のためコードフェンスを除去（プロンプトで禁止しているが保険）
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("抽出結果に JSON オブジェクトが見つかりませんでした");
  }
  const obj = JSON.parse(raw.slice(start, end + 1));
  const list = Array.isArray(obj.trips) ? obj.trips : [];
  if (list.length === 0) {
    throw new Error("出張情報を抽出できませんでした。話した内容を確認してください。");
  }
  return list.map((item: Record<string, unknown>) => normalize(item));
}

/** 欠損項目を型に合わせて補完する */
function normalize(o: Record<string, unknown>): ExtractedTrip {
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  };
  const numOrNull = (v: unknown): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v : null;

  return {
    month: numOrNull(o.month),
    day: numOrNull(o.day),
    destination: strOrNull(o.destination),
    visitTo: strOrNull(o.visitTo),
    purpose: strOrNull(o.purpose),
    routeFrom: strOrNull(o.routeFrom),
    routeTo: strOrNull(o.routeTo),
    roundTrip: o.roundTrip === true,
    transitCompany: strOrNull(o.transitCompany),
    tollParking: num(o.tollParking),
    taxi: num(o.taxi),
    lodging: num(o.lodging),
  };
}

export async function POST(request: Request) {
  let text: string;
  try {
    const body = await request.json();
    text = body?.text;
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  if (!text || typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text が空です" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  // クライアントはリクエスト時に生成（ビルド時にキー不在で失敗しないように）
  const client = new OpenAI();

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      // JSON のみを返させる（システムプロンプトにも "JSON" が含まれている必要がある）
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });

    const out = completion.choices[0]?.message?.content;
    if (!out) {
      throw new Error("モデルからテキスト応答が得られませんでした");
    }

    const trips = parseExtractedList(out);
    return NextResponse.json({ trips });
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API エラー (${err.status}): ${err.message}` },
        { status: 502 }
      );
    }
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
