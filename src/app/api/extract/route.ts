import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { EXTRACT_SYSTEM_PROMPT } from "@/lib/extractPrompt";
import type { ExtractedTrip } from "@/lib/types";

export const runtime = "nodejs";

const client = new Anthropic();

/** モデルの生テキストから最初の JSON オブジェクトを取り出してパースする */
function parseExtracted(text: string): ExtractedTrip {
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
  return normalize(obj);
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const out = response.content.find((b) => b.type === "text");
    if (!out || out.type !== "text") {
      throw new Error("モデルからテキスト応答が得られませんでした");
    }

    const extracted = parseExtracted(out.text);
    return NextResponse.json({ extracted });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API エラー (${err.status}): ${err.message}` },
        { status: 502 }
      );
    }
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
