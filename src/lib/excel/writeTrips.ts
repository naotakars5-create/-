import ExcelJS from "exceljs";
import type { Workbook, Worksheet } from "exceljs";
import type { GenerateRequest, Trip } from "../types";
import { buildRoute } from "../fare";
import {
  BLOCK_START_ROWS,
  MAX_TRIPS_PER_SHEET,
  buildTemplateSheet,
  sheetName,
} from "./template";

/** 1ブロックに書ける経路（G/H列）の最大行数（r..r+3 の4行、H10=SUM(H6:H9)） */
const MAX_LEGS_PER_TRIP = 4;

const TEMPLATE_PATH = "templates/template.xlsx";

/**
 * テンプレ .xlsx を読み込む。存在しなければコードで生成する。
 * どちらの経路でも、以降の書き込み処理は同一のセル配置を前提にできる。
 */
async function loadOrBuildWorkbook(): Promise<{ wb: Workbook; fromFile: boolean }> {
  const wb = new ExcelJS.Workbook();
  try {
    const fs = await import("node:fs/promises");
    const buf = await fs.readFile(TEMPLATE_PATH);
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    return { wb, fromFile: true };
  } catch {
    return { wb, fromFile: false };
  }
}

/** 前半（1-15日）/後半（16-31日）でシートを振り分ける */
function halfOf(day: number): 1 | 2 {
  return day <= 15 ? 1 : 2;
}

/** 指定シートを取得。テンプレに無ければ生成する */
function ensureSheet(wb: Workbook, name: string, fromFile: boolean): Worksheet {
  const existing = wb.getWorksheet(name);
  if (existing) return existing;
  if (fromFile) {
    // テンプレの最初のシートを複製したいが、exceljs に安全な複製 API が無いため
    // 実運用ではテンプレ内に _1/_2 シートを用意しておく想定。無い場合はコード生成。
    return buildTemplateSheet(wb, name);
  }
  return buildTemplateSheet(wb, name);
}

/**
 * 1件の出張を、指定シートの指定ブロック（開始行）に書き込む。
 * 数式セル・結合セルの非アンカー・固定ラベルには一切触れない。
 */
function writeTripBlock(ws: Worksheet, startRow: number, trip: Trip): number {
  const r = startRow;
  ws.getCell(`A${r}`).value = trip.month;
  ws.getCell(`C${r}`).value = trip.day;
  ws.getCell(`E${r}`).value = trip.destination;
  ws.getCell(`E${r + 1}`).value = trip.visitTo;
  ws.getCell(`E${r + 2}`).value = trip.purpose;

  // 経路は区間ごとに G/H 列の各行へ（最大4区間。H10=SUM(H6:H9) が合算する）
  const filled = trip.routes.filter((l) => l.from || l.to || l.fare != null);
  const legs = filled.slice(0, MAX_LEGS_PER_TRIP);
  legs.forEach((leg, i) => {
    const row = r + i;
    ws.getCell(`G${row}`).value = buildRoute(leg.from, leg.to, leg.roundTrip);
    if (leg.fare != null) ws.getCell(`H${row}`).value = leg.fare;
  });

  if (trip.tollParking) ws.getCell(`J${r}`).value = trip.tollParking;
  if (trip.taxi) ws.getCell(`K${r}`).value = trip.taxi;
  if (trip.tollParkingCompany) ws.getCell(`L${r}`).value = trip.tollParkingCompany;
  if (trip.payAllowance && trip.allowance) ws.getCell(`M${r}`).value = trip.allowance;

  return Math.max(0, filled.length - MAX_LEGS_PER_TRIP);
}

/** ヘッダー部・請求部を書き込む */
function writeHeader(ws: Worksheet, req: GenerateRequest): void {
  ws.getCell("I1").value = `　${req.profile.department}`;
  ws.getCell("K1").value = req.profile.name;

  const d = new Date(req.claimDate);
  const reiwa = d.getFullYear() - 2018; // 令和元年 = 2019
  ws.getCell("F37").value = `　　　令和　${reiwa}年 ${d.getMonth() + 1}月${d.getDate()}日`;
  ws.getCell("G38").value = `${req.profile.name}　㊞`;
}

export interface GenerateResult {
  buffer: Buffer;
  warnings: string[];
}

/**
 * 選択された出張リストを、各出張の月・前半/後半ごとにシートへ振り分けて
 * 書き込み、.xlsx バッファを返す。1シート6件を超えたら警告。
 * （どの出張を出力するかは呼び出し側で選択済みの前提。ここでは月での絞り込みはしない）
 */
export async function generateWorkbook(req: GenerateRequest): Promise<GenerateResult> {
  const { wb, fromFile } = await loadOrBuildWorkbook();
  const warnings: string[] = [];

  // (月, 前半/後半) ごとに振り分ける
  const buckets = new Map<string, Trip[]>(); // key: `${month}_${half}`
  for (const t of req.trips) {
    const key = `${t.month}_${halfOf(t.day)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(t);
    else buckets.set(key, [t]);
  }

  // 月 → 前半 → 後半 の順にシートを作る
  const keys = [...buckets.keys()].sort((a, b) => {
    const [ma, ha] = a.split("_").map(Number);
    const [mb, hb] = b.split("_").map(Number);
    return ma - mb || ha - hb;
  });

  const writtenNames = new Set<string>();
  for (const key of keys) {
    const [month, half] = key.split("_").map(Number) as [number, 1 | 2];
    const trips = buckets.get(key)!.sort((a, b) => a.day - b.day);

    const name = sheetName(req.year, month, half);
    const ws = ensureSheet(wb, name, fromFile);
    writtenNames.add(name);
    writeHeader(ws, req);

    trips.forEach((trip, i) => {
      if (i >= MAX_TRIPS_PER_SHEET) return;
      const dropped = writeTripBlock(ws, BLOCK_START_ROWS[i], trip);
      if (dropped > 0) {
        warnings.push(
          `シート ${name} の ${i + 1}件目「${trip.destination || "（未入力）"}」: 経路が${MAX_LEGS_PER_TRIP}区間を超えたため、${dropped}区間が書き込まれませんでした。`
        );
      }
    });

    if (trips.length > MAX_TRIPS_PER_SHEET) {
      warnings.push(
        `シート ${name}: ${trips.length}件の出張がありますが、1シートに書けるのは${MAX_TRIPS_PER_SHEET}件までです。${trips.length - MAX_TRIPS_PER_SHEET}件が書き込まれませんでした。`
      );
    }
  }

  // テンプレ由来の空の雛形シートなど、今回書き込まなかったシートは出力から除去する
  for (const ws of [...wb.worksheets]) {
    if (!writtenNames.has(ws.name)) wb.removeWorksheet(ws.id);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), warnings };
}
