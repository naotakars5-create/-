import ExcelJS from "exceljs";
import type { Workbook, Worksheet } from "exceljs";
import type { GenerateRequest, Trip } from "../types";
import { buildRoute } from "../fare";
import { carAmount, legFare } from "../tripForm";
import {
  BLOCK_START_ROWS,
  MAX_TRIPS_PER_SHEET,
  buildTemplateSheet,
  sheetName,
} from "./template";

/** 1ブロックに書ける経路（G/H列）の最大行数（r..r+3 の4行、H10=SUM(H6:H9)） */
const MAX_LEGS_PER_TRIP = 4;

/**
 * G列（経路）の表示調整。
 * - 通常フォントで収まる容量を超える経路は、フォントを小さく（9pt）して
 *   1行に収まりやすくする（印刷時に枚数が増えないように）。
 * - それでも収まらない場合だけ、行数に応じて行高を広げる（小さめの行高）。
 */
const ROUTE_NORMAL_CAPACITY = 16; // 通常フォントで1行に収まる表示幅（半角換算）
const ROUTE_SMALL_CAPACITY = 19; // 小さめフォント（9pt）で1行に収まる表示幅
const ROUTE_SMALL_FONT_SIZE = 9;
const ROUTE_SMALL_LINE_HEIGHT = 12; // 小さめフォント時の1行あたりの高さ

/** 全角=2, 半角=1 として表示幅を概算する */
function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0xff ? 2 : 1;
  return w;
}

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

/** 指定シートを取得。テンプレに無ければ生成する */
function ensureSheet(wb: Workbook, name: string, fromFile: boolean): Worksheet {
  const existing = wb.getWorksheet(name);
  if (existing) return existing;
  if (fromFile) {
    // テンプレの最初のシートを複製したいが、exceljs に安全な複製 API が無いため
    // 実運用ではテンプレ内に月シートを用意しておく想定。無い場合はコード生成。
    return buildTemplateSheet(wb, name);
  }
  return buildTemplateSheet(wb, name);
}

/**
 * 既存の数式セルに、計算結果（キャッシュ値）を付与する。
 * 数式文字列はそのまま維持し、Excel で開かなくても合計が表示されるようにする。
 */
function setFormulaResult(ws: Worksheet, addr: string, result: number): void {
  const cur = ws.getCell(addr).value as { formula?: string } | undefined;
  if (cur && typeof cur === "object" && typeof cur.formula === "string") {
    ws.getCell(addr).value = { formula: cur.formula, result };
  }
}

/** 1件の出張の、各列（運賃合計・車賃・タクシー・日当・計）の金額を求める */
function tripColumnAmounts(trip: Trip): {
  fare: number;
  toll: number;
  taxi: number;
  allowance: number;
  total: number;
} {
  // 自家用車費も鉄道・バス運賃と同じ H 列に入れるので fare に含める
  const fare = trip.routes.reduce((s, l) => s + legFare(l), 0) + carAmount(trip);
  const toll = trip.tollParking || 0;
  const taxi = trip.taxi || 0;
  const allowance = trip.payAllowance ? trip.allowance || 0 : 0;
  return { fare, toll, taxi, allowance, total: fare + toll + taxi + allowance };
}

/**
 * 1件の出張を、指定シートの指定ブロック（開始行）に書き込む。
 * 数式セル・結合セルの非アンカー・固定ラベルには一切触れない。
 * 戻り値は、4区間を超えて書き込めなかった経路の数。
 */
function writeTripBlock(ws: Worksheet, startRow: number, trip: Trip): number {
  const r = startRow;
  const sub = r + 4; // 小計行
  ws.getCell(`A${r}`).value = trip.month;
  ws.getCell(`C${r}`).value = trip.day;
  ws.getCell(`E${r}`).value = trip.destination;
  ws.getCell(`E${r + 1}`).value = trip.visitTo;
  ws.getCell(`E${r + 2}`).value = trip.purpose;

  // 経路（鉄道・バス）＋自家用車を、G/H 列の各行へ書く（最大4行。H10=SUM(H6:H9) が合算する）
  const lines: { text: string; amount: number | null }[] = [];
  for (const leg of trip.routes) {
    if (leg.from || leg.to || leg.fare != null) {
      // 入力は片道運賃。往復チェック時は2倍で計上する
      lines.push({
        text: buildRoute(leg.from, leg.to, leg.roundTrip),
        amount: leg.fare != null ? legFare(leg) : null,
      });
    }
  }
  const car = carAmount(trip);
  if (trip.carDistanceKm > 0 || car > 0) {
    lines.push({
      text: `自家用車 ${trip.carDistanceKm}km×${trip.carUnitPrice || 0}円`,
      amount: car > 0 ? car : null,
    });
  }

  const shown = lines.slice(0, MAX_LEGS_PER_TRIP);
  shown.forEach((ln, i) => {
    const row = r + i;
    const cell = ws.getCell(`G${row}`);
    cell.value = ln.text;
    if (ln.amount != null) ws.getCell(`H${row}`).value = ln.amount;

    // 通常フォントで収まらない長い経路は、文字を小さく（9pt）して1行に収めやすくする
    const w = displayWidth(ln.text);
    if (w > ROUTE_NORMAL_CAPACITY) {
      cell.font = { size: ROUTE_SMALL_FONT_SIZE };
      const nlines = Math.max(1, Math.ceil(w / ROUTE_SMALL_CAPACITY));
      // 小さくしても収まらないぶんだけ、行の高さを控えめに広げる
      if (nlines > 1) ws.getRow(row).height = nlines * ROUTE_SMALL_LINE_HEIGHT;
    }
  });

  const amt = tripColumnAmounts(trip);
  if (amt.toll) ws.getCell(`J${r}`).value = amt.toll;
  if (amt.taxi) ws.getCell(`K${r}`).value = amt.taxi;
  if (trip.tollParkingCompany) ws.getCell(`L${r}`).value = trip.tollParkingCompany;
  if (amt.allowance) ws.getCell(`M${r}`).value = amt.allowance;

  // 小計行・ブロック計の数式に、計算結果を埋め込む（ビューアで開いても合計が出るように）
  setFormulaResult(ws, `H${sub}`, amt.fare);
  setFormulaResult(ws, `J${sub}`, amt.toll);
  setFormulaResult(ws, `K${sub}`, amt.taxi);
  setFormulaResult(ws, `M${sub}`, amt.allowance);
  setFormulaResult(ws, `O${r}`, amt.total);

  return Math.max(0, lines.length - MAX_LEGS_PER_TRIP);
}

/** シート下部の総計（36〜39行）に計算結果を埋め込む */
function writeSheetTotals(ws: Worksheet, trips: Trip[]): void {
  let fare = 0;
  let sharyo = 0; // 車賃 = 有料道路・駐車場代 + タクシー代
  let allowance = 0;
  for (const t of trips) {
    const a = tripColumnAmounts(t);
    fare += a.fare;
    sharyo += a.toll + a.taxi;
    allowance += a.allowance;
  }
  setFormulaResult(ws, "M36", fare);
  setFormulaResult(ws, "M37", sharyo);
  setFormulaResult(ws, "M38", allowance);
  setFormulaResult(ws, "M39", fare + sharyo + allowance);
}

/** ヘッダー部・請求部を書き込む */
function writeHeader(ws: Worksheet, req: GenerateRequest): void {
  // G1 = 所属。I1 =「氏名」ラベル（テンプレ側）。J1:O1（結合）= 氏名（姓名まとめて）。
  ws.getCell("G1").value = req.profile.department;
  ws.getCell("J1").value = req.profile.name;

  const d = new Date(req.claimDate);
  const reiwa = d.getFullYear() - 2018; // 令和元年 = 2019
  ws.getCell("F37").value = `　　　令和　${reiwa}年 ${d.getMonth() + 1}月${d.getDate()}日`;
  ws.getCell("G38").value = `${req.profile.name}　㊞`;
}

export interface GenerateResult {
  buffer: Buffer;
  warnings: string[];
}

/** 6件ずつのチャンクに分割する */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * 選択された出張リストを月ごとにシートへ振り分けて書き込み、.xlsx バッファを返す。
 * 1シート6件を超える月は、7件目以降を自動的に次のシート（YYYY_M_2 …）へ続ける。
 * 前半/後半での分割はしない。
 */
export async function generateWorkbook(req: GenerateRequest): Promise<GenerateResult> {
  const { wb, fromFile } = await loadOrBuildWorkbook();
  const warnings: string[] = [];

  // 月ごとに振り分ける
  const byMonth = new Map<number, Trip[]>();
  for (const t of req.trips) {
    const arr = byMonth.get(t.month);
    if (arr) arr.push(t);
    else byMonth.set(t.month, [t]);
  }

  const months = [...byMonth.keys()].sort((a, b) => a - b);
  const writtenNames = new Set<string>();

  for (const month of months) {
    // 月内は日付の昇順に並べる
    const monthTrips = byMonth.get(month)!.sort((a, b) => a.day - b.day);
    // 6件ごとにシートを分ける
    const pages = chunk(monthTrips, MAX_TRIPS_PER_SHEET);

    pages.forEach((pageTrips, pageIndex) => {
      const name = sheetName(req.year, month, pageIndex + 1);
      const ws = ensureSheet(wb, name, fromFile);
      writtenNames.add(name);
      writeHeader(ws, req);

      pageTrips.forEach((trip, i) => {
        const dropped = writeTripBlock(ws, BLOCK_START_ROWS[i], trip);
        if (dropped > 0) {
          warnings.push(
            `シート ${name} の ${i + 1}件目「${trip.destination || "（未入力）"}」: 経路が${MAX_LEGS_PER_TRIP}区間を超えたため、${dropped}区間が書き込まれませんでした。`
          );
        }
      });

      writeSheetTotals(ws, pageTrips);
    });
  }

  // テンプレ由来の空の雛形シートなど、今回書き込まなかったシートは出力から除去する
  for (const ws of [...wb.worksheets]) {
    if (!writtenNames.has(ws.name)) wb.removeWorksheet(ws.id);
  }

  // 開いたときに数式を再計算させる（ビューアによってはこれが無いと0/空になる）
  wb.calcProperties.fullCalcOnLoad = true;

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), warnings };
}
