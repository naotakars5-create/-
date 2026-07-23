import ExcelJS from "exceljs";
import type { Workbook, Worksheet } from "exceljs";
import type { GenerateRequest, Trip } from "../types";
import {
  BLOCK_START_ROWS,
  MAX_TRIPS_PER_SHEET,
  buildTemplateSheet,
  sheetName,
} from "./template";

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
function writeTripBlock(ws: Worksheet, startRow: number, trip: Trip): void {
  const r = startRow;
  ws.getCell(`A${r}`).value = trip.month;
  ws.getCell(`C${r}`).value = trip.day;
  ws.getCell(`E${r}`).value = trip.destination;
  ws.getCell(`E${r + 1}`).value = trip.visitTo;
  ws.getCell(`E${r + 2}`).value = trip.purpose;
  ws.getCell(`G${r}`).value = trip.route;
  if (trip.fare != null) ws.getCell(`H${r}`).value = trip.fare;
  ws.getCell(`I${r}`).value = trip.transitCompany;
  if (trip.tollParking) ws.getCell(`J${r}`).value = trip.tollParking;
  if (trip.taxi) ws.getCell(`K${r}`).value = trip.taxi;
  ws.getCell(`L${r}`).value = trip.taxiCompany;
  if (trip.payAllowance && trip.allowance) ws.getCell(`M${r}`).value = trip.allowance;
  if (trip.lodging) ws.getCell(`N${r}`).value = trip.lodging;
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
 * 出張リストを対象年月・前半/後半でシートに振り分けて書き込み、
 * .xlsx バッファを返す。6件を超えたら次シート、それも超えたら警告。
 */
export async function generateWorkbook(req: GenerateRequest): Promise<GenerateResult> {
  const { wb, fromFile } = await loadOrBuildWorkbook();
  const warnings: string[] = [];

  // 対象年月に一致し、前半/後半へ振り分け
  const buckets: Record<1 | 2, Trip[]> = { 1: [], 2: [] };
  for (const t of req.trips) {
    if (t.month !== req.month) continue;
    buckets[halfOf(t.day)].push(t);
  }

  for (const half of [1, 2] as const) {
    const trips = buckets[half].sort((a, b) => a.day - b.day);
    if (trips.length === 0) continue;

    const name = sheetName(req.year, req.month, half);
    const ws = ensureSheet(wb, name, fromFile);
    writeHeader(ws, req);

    trips.forEach((trip, i) => {
      if (i >= MAX_TRIPS_PER_SHEET) return;
      writeTripBlock(ws, BLOCK_START_ROWS[i], trip);
    });

    if (trips.length > MAX_TRIPS_PER_SHEET) {
      warnings.push(
        `シート ${name}: ${trips.length}件の出張がありますが、1シートに書けるのは${MAX_TRIPS_PER_SHEET}件までです。${trips.length - MAX_TRIPS_PER_SHEET}件が書き込まれませんでした。`
      );
    }
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), warnings };
}
