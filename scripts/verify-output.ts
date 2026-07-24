/**
 * 生成した output/sample.xlsx を読み直し、数式・結合セル・入力値・合計結果が
 * 期待どおりか自動検証する CLI。Excel を手で開かずに崩れを検出する。
 *
 * 実行: npm run test:verify （事前に npm run test:write）
 */
import ExcelJS from "exceljs";

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("output/sample.xlsx");

  // 前半/後半で分けず、月ごとに1シート（2026_6）。6件以内なので1枚。
  const ws = wb.getWorksheet("2026_6");
  if (!ws) throw new Error("シート 2026_6 が見つかりません");

  const errors: string[] = [];
  const check = (cond: boolean, msg: string) => {
    if (!cond) errors.push(msg);
  };

  const formula = (addr: string): string | undefined => {
    const v = ws.getCell(addr).value as { formula?: string } | undefined;
    return v?.formula;
  };
  const result = (addr: string): unknown => {
    const v = ws.getCell(addr).value as { result?: unknown } | undefined;
    return v?.result;
  };

  // 数式が保持されているか
  check(formula("O6") === "SUM(H10:N10)", `O6 数式不一致: ${formula("O6")}`);
  check(formula("H10") === "SUM(H6:H9)", `H10 数式不一致: ${formula("H10")}`);
  check(formula("M10") === "SUM(M6:N9)", `M10 数式不一致: ${formula("M10")}`);
  check(formula("H25") === "SUM(H21:H24)", `H25 数式欠落/不一致: ${formula("H25")}`);
  check(formula("M39") === "SUM(M36:O38)", `M39 数式不一致: ${formula("M39")}`);

  // ヘッダー: G1=所属、I1=「氏名」ラベル、J1(結合)=氏名（姓名まとめて）
  check(ws.getCell("G1").value === "営業部", `G1(所属) 不一致: ${ws.getCell("G1").value}`);
  check(!String(ws.getCell("G1").value ?? "").includes("局"), `G1 に「局」が残っている: ${ws.getCell("G1").value}`);
  check(ws.getCell("H1").value == null, `H1 に値が残っている（局の消し漏れ）: ${ws.getCell("H1").value}`);
  check(ws.getCell("I1").value === "氏名", `I1(氏名ラベル) 不一致: ${ws.getCell("I1").value}`);
  check(ws.getCell("J1").value === "山田　太郎", `J1(氏名) 不一致: ${ws.getCell("J1").value}`);
  check(
    ws.getCell("G38").value === "山田　太郎　㊞",
    `G38(請求者) 不一致: ${ws.getCell("G38").value}`
  );
  // 請求欄ラベルが金額欄と隣り合うよう I:L に結合されているか
  check(ws.getCell("I36").value === "運　賃　等", `I36(運賃ラベル) 不一致: ${ws.getCell("I36").value}`);
  check(ws.getCell("I38").value === "日当・宿泊", `I38(日当ラベル) 不一致: ${ws.getCell("I38").value}`);

  // 1件目（開始行6, 6月12日）
  check(ws.getCell("A6").value === 6, `A6(月) 不一致: ${ws.getCell("A6").value}`);
  check(ws.getCell("C6").value === 12, `C6(日) 不一致: ${ws.getCell("C6").value}`);
  check(ws.getCell("E6").value === "鎌ケ谷", `E6 不一致: ${ws.getCell("E6").value}`);
  check(
    ws.getCell("G6").value === "千葉-鎌ケ谷大仏(往復)",
    `G6(経路 往復) 不一致: ${ws.getCell("G6").value}`
  );
  check(ws.getCell("H6").value === 980, `H6(運賃 片道490×往復) 不一致: ${ws.getCell("H6").value}`);
  check(ws.getCell("M6").value === 1350, `M6(日当 主任) 不一致: ${ws.getCell("M6").value}`);
  // 合計結果が埋め込まれているか（ビューアで開いても合計が出る）
  check(result("O6") === 2330, `O6(ブロック計の結果) 不一致: ${result("O6")}`);

  // 宿泊料は廃止したので N 列には何も書かれないこと
  check(ws.getCell("N6").value == null, `N6(宿泊料 廃止) に値が残っている: ${ws.getCell("N6").value}`);

  // 2件目（開始行11, 6月20日）: 日付昇順で同一シートの2ブロック目に並ぶ
  check(
    ws.getCell("G11").value === "千葉-幕張豊砂駅(往復)",
    `G11(経路1) 不一致: ${ws.getCell("G11").value}`
  );
  check(
    ws.getCell("G12").value === "幕張豊砂駅-海浜幕張",
    `G12(経路2 片道) 不一致: ${ws.getCell("G12").value}`
  );
  check(ws.getCell("H11").value === 820, `H11(往復2倍計上) 不一致: ${ws.getCell("H11").value}`);
  check(ws.getCell("H12").value == null, `H12(片道・マスタ外) 不一致: ${ws.getCell("H12").value}`);
  check(ws.getCell("J11").value === 800, `J11(駐車場代) 不一致: ${ws.getCell("J11").value}`);
  check(ws.getCell("K11").value === 1200, `K11(タクシー) 不一致: ${ws.getCell("K11").value}`);
  check(
    ws.getCell("L11").value === "タイムズ幕張",
    `L11(利用会社 コインP) 不一致: ${ws.getCell("L11").value}`
  );

  // シート総計の結果（運賃1800 / 車賃2000 / 日当1350 / 計5150）
  check(result("M36") === 1800, `M36(運賃計) 不一致: ${result("M36")}`);
  check(result("M37") === 2000, `M37(車賃計) 不一致: ${result("M37")}`);
  check(result("M38") === 1350, `M38(日当計) 不一致: ${result("M38")}`);
  check(result("M39") === 5150, `M39(総計) 不一致: ${result("M39")}`);

  // 固定ラベルに触れていないか
  check(ws.getCell("B6").value === "/", `B6 固定ラベル破損: ${ws.getCell("B6").value}`);

  // 前半/後半シートは作らない
  check(!wb.getWorksheet("2026_6_1"), "2026_6_1 が残っている（前半後半分割は廃止のはず）");
  check(!wb.getWorksheet("2026_6_2"), "2026_6_2 が残っている（前半後半分割は廃止のはず）");

  if (errors.length) {
    console.error("検証失敗:");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log("検証OK: 数式・結合セル・入力値・合計結果すべて期待どおり");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
