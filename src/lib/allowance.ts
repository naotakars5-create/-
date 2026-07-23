import type { Position, Trip } from "./types";

/** 役職ごとの日当固定額 */
export const ALLOWANCE_BY_POSITION: Record<Position, number> = {
  一般職員: 1250,
  主任: 1350,
  副参事: 1400,
  "部次長・参事": 1450,
  "部長・担当部長": 1650,
  局長: 1750,
};

export function getAllowance(position: Position): number {
  return ALLOWANCE_BY_POSITION[position];
}

/**
 * 日当の支給条件は未確定のため、現時点では常に false（ユーザーが画面でトグル）。
 * ルール確定後はこの関数に自動判定を実装し、UI 側の初期値に反映する。
 */
export function shouldPayAllowance(_trip: Pick<Trip, "destination" | "route" | "lodging">): boolean {
  return false;
}
