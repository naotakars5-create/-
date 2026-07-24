import { POSITIONS, type Position, type UserProfile } from "./types";

const STORAGE_KEY = "travel-expense-profile-v1";

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  department: "",
  position: "一般職員",
  carUnitPrice: 0,
  customAllowance: 0,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isPosition(v: unknown): v is Position {
  return typeof v === "string" && (POSITIONS as readonly string[]).includes(v);
}

/** 旧・個別の役職名を、まとめた項目へ読み替える */
const POSITION_MIGRATION: Record<string, Position> = {
  局長: "局長・局次長・担当局長",
  局次長: "局長・局次長・担当局長",
  担当局長: "局長・局次長・担当局長",
};

function normalizePosition(v: unknown): Position {
  if (typeof v === "string" && POSITION_MIGRATION[v]) return POSITION_MIGRATION[v];
  return isPosition(v) ? v : "一般職員";
}

/** 設定（氏名・所属・役職）を読み込む。未保存ならデフォルトを返す。ブラウザ内のみ */
export function loadProfile(): UserProfile {
  if (!isBrowser()) return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const p = JSON.parse(raw);

    // 氏名: 現行の name。無ければ旧形式（姓・名の2欄）を結合して移行する
    let name = typeof p?.name === "string" ? p.name : "";
    if (name === "") {
      const last = typeof p?.lastName === "string" ? p.lastName : "";
      const first = typeof p?.firstName === "string" ? p.firstName : "";
      name = `${last}　${first}`.trim();
    }

    return {
      name,
      department: typeof p?.department === "string" ? p.department : "",
      position: normalizePosition(p?.position),
      carUnitPrice: typeof p?.carUnitPrice === "number" ? p.carUnitPrice : 0,
      customAllowance: typeof p?.customAllowance === "number" ? p.customAllowance : 0,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/** 設定を保存する（変更のたびに呼ぶ）。ブラウザ内のみ、サーバには送らない */
export function saveProfile(profile: UserProfile): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // 保存失敗は致命的ではないため無視する
  }
}
