/**
 * テンプレ .xlsx をコードから生成して templates/template.xlsx に保存する CLI。
 * 進め方(1): まず書き込みを CLI で確立し、Excel で開いて体裁・数式が
 * 崩れていないことを確認するための土台。
 *
 * 実行: npm run template
 */
import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { buildTemplateSheet, sheetName } from "../src/lib/excel/template";

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "travel-expense-voice-app";
  // 半月分 x2 の空シートを用意（前半 _1 / 後半 _2）
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  buildTemplateSheet(wb, sheetName(year, month, 1));
  buildTemplateSheet(wb, sheetName(year, month, 2));

  await mkdir("templates", { recursive: true });
  const buf = await wb.xlsx.writeBuffer();
  await writeFile("templates/template.xlsx", Buffer.from(buf));
  console.log("templates/template.xlsx を生成しました");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
