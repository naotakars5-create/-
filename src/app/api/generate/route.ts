import { NextResponse } from "next/server";
import { generateWorkbook } from "@/lib/excel/writeTrips";
import type { GenerateRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let req: GenerateRequest;
  try {
    req = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  if (!req?.profile || !Array.isArray(req.trips)) {
    return NextResponse.json({ error: "profile / trips が不正です" }, { status: 400 });
  }
  if (req.trips.length === 0) {
    return NextResponse.json({ error: "出力する出張が選択されていません" }, { status: 400 });
  }

  try {
    const { buffer, warnings } = await generateWorkbook(req);
    // ファイル名は含まれる月から決める（1か月なら _M、複数月なら年のみ）
    const months = [...new Set(req.trips.map((t) => t.month))];
    const filename =
      months.length === 1
        ? `旅費精算書_${req.year}_${months[0]}.xlsx`
        : `旅費精算書_${req.year}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Warnings": encodeURIComponent(JSON.stringify(warnings)),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "生成に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
