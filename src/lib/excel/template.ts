import type { Worksheet, Workbook } from "exceljs";

/** 出張ブロックの開始行（1件 = 5行、最大6件/シート） */
export const BLOCK_START_ROWS = [6, 11, 16, 21, 26, 31] as const;
export const MAX_TRIPS_PER_SHEET = BLOCK_START_ROWS.length;

/**
 * シート名: YYYY_M（その月の1枚目）。6件を超えて2枚目以降が必要なら
 * YYYY_M_2, YYYY_M_3 … と続ける（前半/後半での分割はしない）。
 */
export function sheetName(year: number, month: number, part: number): string {
  return part <= 1 ? `${year}_${month}` : `${year}_${month}_${part}`;
}

const THIN = { style: "thin" as const };
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const MONEY_FMT = "#,##0";

/**
 * 旅費精算書の1シートを、実際に使われている過去分（.xls, 2025年7月〜2026年6月分の
 * 25シート）を実測して得た配置・結合セル・固定文言のとおりに構築する。
 *
 * 実測方法: アップロードされた実ファイルを xlrd で解析し、セル値・結合範囲を
 * 全シート横断で比較。ラベル文言・会社名・請求文言（A37/A38/G1 等）は
 * 全期間で完全に一致しており、様式の固定部分（テンプレそのもの）と判断した。
 * 出張データ（E6等）と請求日（F37）のみがシートごとに変化するデータ部分。
 *
 * 既存ファイルで欠落していた H25 の数式（4件目ブロックの小計、
 * 2026_6_1 実データでも同じ欠落を確認済み）は、ここでは
 * SUM(H21:H24) として補って生成する。
 */
export function buildTemplateSheet(wb: Workbook, name: string): Worksheet {
  const ws = wb.addWorksheet(name, {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  // 列幅（A..P）
  const widths = [4, 2.5, 4, 5, 9, 9, 16, 10, 8, 10, 9, 8, 8, 9, 6, 6];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // ---- 1行目（タイトル・所属/氏名） ----
  ws.getCell("A1").value = "旅費精算書";
  ws.getCell("A1").font = { size: 14, bold: true };
  ws.getCell("E1").value = "旅行者";
  ws.getCell("F1").value = "所属";
  // 実測どおりの固定文言（全期間で一致。同一組織の業務局ラベル）
  ws.getCell("G1").value = "　　　       業務         局";
  // I1 = 「氏名」ラベル。J1:O1(結合) = 氏名（姓名まとめて）。値はアプリ側が書き込む。
  ws.getCell("I1").value = "氏名";
  ws.mergeCells("J1:O1");
  for (const addr of ["E1", "F1", "I1"]) {
    ws.getCell(addr).font = { size: 9 };
  }

  // ---- 列見出し（2〜5行、2段構成） ----
  ws.mergeCells("A2:C5");
  ws.getCell("A2").value = "月日";
  ws.mergeCells("D2:F5");
  ws.getCell("D2").value = "出張先・用務・番組名等";
  ws.mergeCells("G2:G5");
  ws.getCell("G2").value = "経　　路";
  ws.mergeCells("H2:I2");
  ws.getCell("H2").value = "運　　　　賃　　　　等";
  ws.mergeCells("J2:L2");
  ws.getCell("J2").value = "車賃";
  ws.mergeCells("M2:N2");
  ws.getCell("M2").value = "日当・宿泊";
  ws.mergeCells("O2:P5");
  ws.getCell("O2").value = "計";

  ws.mergeCells("H3:H5");
  ws.getCell("H3").value = "鉄道・バス";
  ws.mergeCells("I3:I5");
  ws.getCell("I3").value = "利用会社";
  ws.mergeCells("J3:J5");
  ws.getCell("J3").value = "有料道路　　駐車場代";
  ws.mergeCells("K3:K5");
  ws.getCell("K3").value = "ﾀｸｼｰ代";
  ws.mergeCells("L3:L5");
  ws.getCell("L3").value = "利用会社";
  ws.mergeCells("M3:M5");
  ws.getCell("M3").value = "日当";
  ws.mergeCells("N3:N5");
  ws.getCell("N3").value = "宿泊料";

  for (const addr of ["A2", "D2", "G2", "H2", "J2", "M2", "O2", "H3", "I3", "J3", "K3", "L3", "M3", "N3"]) {
    const c = ws.getCell(addr);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.font = { size: 9 };
    c.border = BORDER_ALL;
  }

  // ---- 出張ブロック（6〜35行、5行×6ブロック） ----
  for (const r of BLOCK_START_ROWS) {
    const sub = r + 4; // 小計行

    // 結合セル（実測どおり）
    ws.mergeCells(`A${r}:A${sub}`); // 月
    ws.mergeCells(`B${r}:B${sub}`); // "/"
    ws.mergeCells(`C${r}:C${sub}`); // 日
    ws.mergeCells(`D${r}:D${r + 1}`); // 「出張先」ラベル
    ws.mergeCells(`E${r}:F${r}`); // 出張先（値）
    ws.mergeCells(`E${r + 1}:F${r + 1}`); // 訪問先名（値）
    ws.mergeCells(`D${r + 2}:D${sub}`); // 「用 務」ラベル
    ws.mergeCells(`E${r + 2}:F${sub}`); // 用務（値）
    ws.mergeCells(`M${r}:M${r + 3}`); // 日当（値）
    ws.mergeCells(`N${r}:N${r + 3}`); // 宿泊料（値）
    ws.mergeCells(`O${r}:P${sub}`); // ブロック計
    ws.mergeCells(`M${sub}:N${sub}`); // 小計行の日当・宿泊合計

    // 固定ラベル
    ws.getCell(`B${r}`).value = "/";
    ws.getCell(`B${r}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`D${r}`).value = "出張先";
    ws.getCell(`D${r + 2}`).value = "用 務";
    ws.getCell(`D${r}`).font = { size: 8 };
    ws.getCell(`D${r + 2}`).font = { size: 8 };
    ws.getCell(`D${r}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`D${r + 2}`).alignment = { horizontal: "center", vertical: "middle" };

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
    ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`C${r}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`E${r}`).alignment = { vertical: "middle" };
    ws.getCell(`E${r + 1}`).alignment = { vertical: "middle" };
    ws.getCell(`E${r + 2}`).alignment = { vertical: "top", wrapText: true };
    ws.getCell(`M${r}`).alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell(`N${r}`).alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell(`O${r}`).alignment = { horizontal: "right", vertical: "middle" };
  }

  // ---- 総計・請求部（36〜39行） ----
  ws.mergeCells("A36:C36"); // 実測どおりの空欄枠（署名・捺印スペース）
  ws.mergeCells("A39:C39");
  ws.getCell("E36").value = "　　このとおり請求します。";
  // ラベル（運賃等/車賃/日当宿泊/計）は I:L に結合し、金額欄 M:O と隙間なく隣り合わせる
  ws.mergeCells("I36:L36");
  ws.mergeCells("I37:L37");
  ws.mergeCells("I38:L38");
  ws.mergeCells("I39:L39");
  ws.getCell("I36").value = "運　賃　等";
  ws.getCell("I37").value = "車　　　　賃";
  ws.getCell("I38").value = "日当・宿泊";
  ws.getCell("I39").value = "計";

  const blockSubRows = BLOCK_START_ROWS.map((r) => r + 4); // 10,15,20,25,30,35
  ws.mergeCells("M36:O36");
  ws.getCell("M36").value = { formula: blockSubRows.map((r) => `H${r}`).join("+") };
  ws.mergeCells("M37:O37");
  ws.getCell("M37").value = {
    formula:
      blockSubRows.map((r) => `J${r}`).join("+") +
      "+" +
      blockSubRows.map((r) => `K${r}`).join("+"),
  };
  ws.mergeCells("M38:O38");
  ws.getCell("M38").value = { formula: blockSubRows.map((r) => `M${r}`).join("+") };
  ws.mergeCells("M39:O39");
  ws.getCell("M39").value = { formula: "SUM(M36:O38)" };
  for (const addr of ["M36", "M37", "M38", "M39"]) {
    ws.getCell(addr).numFmt = MONEY_FMT;
    ws.getCell(addr).border = BORDER_ALL;
    ws.getCell(addr).alignment = { horizontal: "right", vertical: "middle" };
  }
  for (const row of [36, 37, 38, 39]) {
    // 結合したラベル箱 I:L の全セルに罫線を引き、外枠が閉じるようにする
    for (let col = 9; col <= 12; col++) {
      ws.getRow(row).getCell(col).border = BORDER_ALL;
    }
    const anchor = ws.getCell(`I${row}`);
    anchor.font = { size: 9 };
    anchor.alignment = { horizontal: "center", vertical: "middle" };
  }

  // 固定文言（実測: 全25シートで完全に一致していた請求先の定型文）
  ws.getCell("A37").value = "千葉テレビ放送株式会社";
  ws.getCell("A38").value = "代表取締役社長　殿";
  ws.getCell("F38").value = "請求者";
  ws.mergeCells("F38:F39");
  ws.mergeCells("G38:H39");
  // F37 = 請求日（値）, G38 = 請求者名 + ㊞（値）はアプリ側が書き込む

  return ws;
}
