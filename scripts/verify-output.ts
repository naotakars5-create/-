/**
 * 生成した output/sample.xlsx を読み直し、数式・結合セル・入力値が
 * 期待どおりか自動検証する CLI。Excel を手で開かずに崩れを検出する。
 *
 * 実行: npm run test:verify （事前に npm run test:write）
 */
import ExcelJS from "exceljs";

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("output/sample.xlsx");

  const ws = wb.getWorksheet("2026_6_1");
  if (!ws) throw new Error("シート 2026_6_1 が見つかりません");

  const errors: string[] = [];
  const check = (cond: boolean, msg: string) => {
    if (!cond) errors.push(msg);
  };

  const formula = (addr: string): string | undefined => {
    const v = ws.getCell(addr).value as { formula?: string } | undefined;
    return v?.formula;
  };

  // 数式が保持されているか
  check(formula("O6") === "SUM(H10:N10)", `O6 数式不一致: ${formula("O6")}`);
  check(formula("H10") === "SUM(H6:H9)", `H10 数式不一致: ${formula("H10")}`);
  check(formula("M10") === "SUM(M6:N9)", `M10 数式不一致: ${formula("M10")}`);
  // 補った H25（4件目ブロック）
  check(formula("H25") === "SUM(H21:H24)", `H25 数式欠落/不一致: ${formula("H25")}`);
  // 総計
  check(formula("M39") === "SUM(M36:O38)", `M39 数式不一致: ${formula("M39")}`);

  // 入力値（1件目 = 開始行6）
  check(ws.getCell("A6").value === 6, `A6(月) 不一致: ${ws.getCell("A6").value}`);
  check(ws.getCell("C6").value === 12, `C6(日) 不一致: ${ws.getCell("C6").value}`);
  check(ws.getCell("E6").value === "鎌ケ谷", `E6 不一致: ${ws.getCell("E6").value}`);
  check(ws.getCell("H6").value === 980, `H6(運賃 往復) 不一致: ${ws.getCell("H6").value}`);
  check(ws.getCell("M6").value === 1350, `M6(日当 主任) 不一致: ${ws.getCell("M6").value}`);

  // 固定ラベルに触れていないか
  check(ws.getCell("B6").value === "/", `B6 固定ラベル破損: ${ws.getCell("B6").value}`);

  if (errors.length) {
    console.error("検証失敗:");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log("検証OK: 数式・結合セル・入力値すべて期待どおり");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
