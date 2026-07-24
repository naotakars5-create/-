/**
 * サンプル出張データを書き込み、output/sample.xlsx を生成する CLI。
 * Excel で開いて数式・書式・結合セルが崩れていないか目視確認する。
 *
 * 実行: npm run test:write
 */
import { mkdir, writeFile } from "node:fs/promises";
import { generateWorkbook } from "../src/lib/excel/writeTrips";
import { getAllowance } from "../src/lib/allowance";
import { getFare } from "../src/lib/fare";
import type { Trip } from "../src/lib/types";

function makeTrip(partial: Partial<Trip> & Pick<Trip, "id" | "month" | "day">): Trip {
  return {
    destination: "",
    visitTo: "",
    purpose: "",
    routes: [],
    carDistanceKm: 0,
    carUnitPrice: 0,
    tollParking: 0,
    tollParkingCompany: "",
    taxi: 0,
    payAllowance: false,
    allowance: 0,
    ...partial,
  };
}

/** 駅名ペアから経路区間を作る（運賃は片道額。往復は出力時に2倍計上される） */
function leg(from: string, to: string, roundTrip: boolean) {
  return { from, to, roundTrip, fare: getFare(from, to, false) };
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
      routes: [leg("千葉", "鎌ケ谷大仏", true)],
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
      // 複数区間（乗り継ぎ）の例
      routes: [leg("千葉", "幕張豊砂駅", true), leg("幕張豊砂駅", "海浜幕張", false)],
      tollParking: 800,
      tollParkingCompany: "タイムズ幕張",
      taxi: 1200,
    }),
    makeTrip({
      id: "3",
      month: 6,
      day: 25,
      destination: "市原",
      visitTo: "市原工場",
      purpose: "顧客打ち合わせ",
      // 自家用車の例（距離30km × 単価15円 = 450円）
      carDistanceKm: 30,
      carUnitPrice: 15,
    }),
  ];

  const { buffer, warnings } = await generateWorkbook({
    profile: { name: "山田　太郎", department: "営業部", position, carUnitPrice: 15, customAllowance: 0 },
    trips,
    year: 2026,
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
