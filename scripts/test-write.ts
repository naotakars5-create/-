/**
 * サンプル出張データを書き込み、output/sample.xlsx を生成する CLI。
 * Excel で開いて数式・書式・結合セルが崩れていないか目視確認する。
 *
 * 実行: npm run test:write
 */
import { mkdir, writeFile } from "node:fs/promises";
import { generateWorkbook } from "../src/lib/excel/writeTrips";
import { getAllowance } from "../src/lib/allowance";
import { buildRoute, getFare } from "../src/lib/fare";
import type { Trip } from "../src/lib/types";

function makeTrip(partial: Partial<Trip> & Pick<Trip, "id" | "month" | "day">): Trip {
  return {
    destination: "",
    visitTo: "",
    purpose: "",
    route: "",
    fare: null,
    transitCompany: "",
    tollParking: 0,
    taxi: 0,
    taxiCompany: "",
    payAllowance: false,
    allowance: 0,
    lodging: 0,
    ...partial,
  };
}

async function main() {
  const position = "主任" as const;
  const allowance = getAllowance(position);

  const trips: Trip[] = [
    makeTrip({
      id: "1",
      month: 6,
      day: 12,
      destination: "鎌ケ谷",
      visitTo: "鎌ケ谷巧業",
      purpose: "顧客打ち合わせ",
      route: buildRoute("千葉", "鎌ケ谷大仏", true),
      fare: getFare("千葉", "鎌ケ谷大仏", true),
      payAllowance: true,
      allowance,
    }),
    makeTrip({
      id: "2",
      month: 6,
      day: 20,
      destination: "幕張",
      visitTo: "幕張メッセ",
      purpose: "展示会視察",
      route: buildRoute("千葉", "幕張豊砂駅", true),
      fare: getFare("千葉", "幕張豊砂駅", true),
      taxi: 1200,
      taxiCompany: "京成タクシー",
      lodging: 8000,
    }),
  ];

  const { buffer, warnings } = await generateWorkbook({
    profile: { name: "山田太郎", department: "営業部", position },
    trips,
    year: 2026,
    month: 6,
    claimDate: "2026-07-01",
  });

  await mkdir("output", { recursive: true });
  await writeFile("output/sample.xlsx", buffer);
  console.log("output/sample.xlsx を生成しました");
  if (warnings.length) console.log("警告:", warnings);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
