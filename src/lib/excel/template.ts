import type { Worksheet, Workbook } from "exceljs";

/** 出張ブロックの開始行（1件 = 5行、最大6件/シート） */
export const BLOCK_START_ROWS = [6, 11, 16, 21, 26, 31] as const;
export const MAX_TRIPS_PER_SHEET = BLOCK_START_ROWS.length;

/** シート名: YYYY_M_1（前半）/ YYYY_M_2（後半）。新規作成は _1 / _2 で統一 */
export function sheetName(year: number, month: number, half: 1 | 2): string {
  return `${year}_${month}_${half}`;
}

const THIN = { style: "thin" as const };
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const MONEY_FMT = "#,##0";

/**
 * 旅費精算書の1シートを既存様式に合わせて構築する。
 *
 * 本来は既存 .xls を変換した .xlsx をテンプレとして読み込むが、
 * リポジトリにテンプレファイルが存在しないため、実測済みのセル配置
 * （仕様書記載）どおりにコードで再現する。実ファイルが用意されたら
 * templates/template.xlsx を差し替えるだけで writeTrips 側はそのまま動く。
 *
 * 既存ファイルで欠落していた H25 の数式（4件目ブロックの小計）は
 * ここで SUM(H21:H24) として補っている。
 */
export function buildTemplateSheet(wb: Workbook, name: string): Worksheet {
  const ws = wb.addWorksheet(name, {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  // 列幅（A..P）
  const widths = [4, 2.5, 4, 5, 9, 9, 16, 10, 8, 10, 9, 8, 8, 9, 6, 6];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // ---- ヘッダー部（1〜5行） ----
  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = "旅　費　精　算　書";
  ws.getCell("A1").font = { size: 14, bold: true };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.getCell("H1").value = "所属";
  ws.mergeCells("I1:J1"); // I1 = 所属（値）
  ws.getCell("K1").value = "氏名"; // ラベルは K1 の左…実測では K1 が値のため L? → 仕様どおり K1 を値セルとする
  // 仕様: I1=所属（値）, K1=氏名（値）。ラベルは H1 / J1 に置く。
  ws.getCell("K1").value = "";
  ws.getCell("J1").value = "氏名";
  ws.mergeCells("K1:M1");

  // 列見出し（4〜5行）
  ws.mergeCells("A4:C5");
  ws.getCell("A4").value = "月　日";
  ws.mergeCells("D4:F5");
  ws.getCell("D4").value = "出張先・用務";
  ws.mergeCells("G4:G5");
  ws.getCell("G4").value = "経　路";
  ws.mergeCells("H4:H5");
  ws.getCell("H4").value = "鉄道・バス\n運賃";
  ws.mergeCells("I4:I5");
  ws.getCell("I4").value = "利用会社";
  ws.mergeCells("J4:J5");
  ws.getCell("J4").value = "有料道路・\n駐車場代";
  ws.mergeCells("K4:K5");
  ws.getCell("K4").value = "タクシー代";
  ws.mergeCells("L4:L5");
  ws.getCell("L4").value = "利用会社";
  ws.mergeCells("M4:M5");
  ws.getCell("M4").value = "日　当";
  ws.mergeCells("N4:N5");
  ws.getCell("N4").value = "宿泊料";
  ws.mergeCells("O4:P5");
  ws.getCell("O4").value = "計";
  for (const addr of ["A4", "D4", "G4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4"]) {
    const c = ws.getCell(addr);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.font = { size: 9 };
  }

  // ---- 出張ブロック（6〜35行） ----
  for (const r of BLOCK_START_ROWS) {
    const sub = r + 4; // 小計行

    // 結合セル
    ws.mergeCells(`E${r}:F${r}`); // 出張先
    ws.mergeCells(`E${r + 1}:F${r + 1}`); // 訪問先名
    ws.mergeCells(`E${r + 2}:F${sub}`); // 用務
    ws.mergeCells(`M${r}:M${r + 3}`); // 日当
    ws.mergeCells(`N${r}:N${r + 3}`); // 宿泊料
    ws.mergeCells(`O${r}:P${sub}`); // ブロック計

    // 固定ラベル
    ws.getCell(`B${r}`).value = "/";
    ws.getCell(`B${r}`).alignment = { horizontal: "center" };
    ws.getCell(`D${r}`).value = "出張先";
    ws.getCell(`D${r + 2}`).value = "用 務";
    ws.getCell(`D${r}`).font = { size: 8 };
    ws.getCell(`D${r + 2}`).font = { size: 8 };
    ws.getCell(`G${sub}`).value = "計";
    ws.getCell(`G${sub}`).alignment = { horizontal: "right" };
    ws.getCell(`G${sub}`).font = { size: 9 };

    // 既存数式（絶対に値で上書きしないこと）
    ws.getCell(`O${r}`).value = { formula: `SUM(H${sub}:N${sub})` };
    ws.getCell(`H${sub}`).value = { formula: `SUM(H${r}:H${r + 3})` };
    ws.getCell(`J${sub}`).value = { formula: `SUM(J${r}:J${r + 3})` };
    ws.getCell(`K${sub}`).value = { formula: `SUM(K${r}:K${r + 3})` };
    ws.getCell(`M${sub}`).value = { formula: `SUM(M${r}:N${r + 3})` };

    // 書式
    for (let row = r; row <= sub; row++) {
      for (let col = 1; col <= 16; col++) {
        const cell = ws.getRow(row).getCell(col);
        cell.border = BORDER_ALL;
        if (col >= 8 && col <= 16 && col !== 9 && col !== 12) {
          cell.numFmt = MONEY_FMT;
        }
      }
    }
    ws.getCell(`E${r}`).alignment = { vertical: "middle" };
    ws.getCell(`E${r + 1}`).alignment = { vertical: "middle" };
    ws.getCell(`E${r + 2}`).alignment = { vertical: "top", wrapText: true };
    ws.getCell(`M${r}`).alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell(`N${r}`).alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell(`O${r}`).alignment = { horizontal: "right", vertical: "middle" };
  }

  // ---- 総計・請求部（36〜39行） ----
  ws.getCell("L36").value = "運賃等";
  ws.getCell("L37").value = "車賃";
  ws.getCell("L38").value = "日当・宿泊料";
  ws.getCell("L39").value = "計";
  const blockSubRows = BLOCK_START_ROWS.map((r) => r + 4); // 10,15,20,25,30,35
  ws.getCell("M36").value = { formula: blockSubRows.map((r) => `H${r}`).join("+") };
  ws.getCell("M37").value = {
    formula:
      blockSubRows.map((r) => `J${r}`).join("+") +
      "+" +
      blockSubRows.map((r) => `K${r}`).join("+"),
  };
  ws.getCell("M38").value = { formula: blockSubRows.map((r) => `M${r}`).join("+") };
  ws.getCell("M39").value = { formula: "SUM(M36:O38)" };
  for (const addr of ["M36", "M37", "M38", "M39"]) {
    ws.getCell(addr).numFmt = MONEY_FMT;
    ws.getCell(addr).border = BORDER_ALL;
  }
  for (const addr of ["L36", "L37", "L38", "L39"]) {
    ws.getCell(addr).border = BORDER_ALL;
    ws.getCell(addr).font = { size: 9 };
    ws.getCell(addr).alignment = { horizontal: "center" };
  }

  ws.getCell("A36").value = "上記のとおり請求します。";
  ws.getCell("E37").value = "請求日";
  ws.getCell("E38").value = "請求者";
  // F37 = 請求日（値）, G38 = 請求者名 + ㊞（値）はアプリ側で書き込む

  return ws;
}
