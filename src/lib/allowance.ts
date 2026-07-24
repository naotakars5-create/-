import type { Position, Trip, UserProfile } from "./types";

/** 役職ごとの日当固定額（0 = 固定額なし・手入力） */
export const ALLOWANCE_BY_POSITION: Record<Position, number> = {
  一般職員: 1250,
  主任: 1350,
  副参事: 1400,
  "部次長・参事": 1450,
  "部長・担当部長": 1650,
  "局長・局次長・担当局長": 1750,
  役員: 0, // 固定額なし。設定で手入力する
};

export function getAllowance(position: Position): number {
  return ALLOWANCE_BY_POSITION[position];
}

/** その役職に固定の日当額があるか（無い＝役員などは手入力） */
export function hasFixedAllowance(position: Position): boolean {
  return getAllowance(position) > 0;
}

/** 実際に使う日当額（固定額があればそれ、無ければ手入力額） */
export function effectiveAllowance(
  profile: Pick<UserProfile, "position" | "customAllowance">
): number {
  const fixed = getAllowance(profile.position);
  return fixed > 0 ? fixed : profile.customAllowance || 0;
}

/**
 * 日当の支給条件は未確定のため、現時点では常に false（ユーザーが画面でトグル）。
 * ルール確定後はこの関数に自動判定を実装し、UI 側の初期値に反映する。
 */
export function shouldPayAllowance(_trip: Pick<Trip, "destination" | "routes">): boolean {
  return false;
}
