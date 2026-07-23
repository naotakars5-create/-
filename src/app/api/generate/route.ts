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

  try {
    const { buffer, warnings } = await generateWorkbook(req);
    const filename = `旅費精算書_${req.year}_${req.month}.xlsx`;
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
