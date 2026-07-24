import { POSITIONS, type Position, type UserProfile } from "./types";

const STORAGE_KEY = "travel-expense-profile-v1";

const DEFAULT_PROFILE: UserProfile = {
  lastName: "",
  firstName: "",
  department: "",
  position: "一般職員",
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isPosition(v: unknown): v is Position {
  return typeof v === "string" && (POSITIONS as readonly string[]).includes(v);
}

/** 旧形式の氏名（1つの name 文字列）を姓・名に分割する。空白区切りが無ければ全体を姓に入れる */
function splitLegacyName(name: string): { lastName: string; firstName: string } {
  const parts = name.trim().split(/[\s　]+/).filter(Boolean);
  if (parts.length >= 2) {
    return { lastName: parts[0], firstName: parts.slice(1).join("　") };
  }
  return { lastName: name.trim(), firstName: "" };
}

/** 設定（姓・名・所属・役職）を読み込む。未保存ならデフォルトを返す。ブラウザ内のみ */
export function loadProfile(): UserProfile {
  if (!isBrowser()) return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const p = JSON.parse(raw);

    // 旧形式（name 1つ）は姓・名に分割して移行する
    let lastName = typeof p?.lastName === "string" ? p.lastName : "";
    let firstName = typeof p?.firstName === "string" ? p.firstName : "";
    if (!lastName && !firstName && typeof p?.name === "string" && p.name.trim() !== "") {
      const split = splitLegacyName(p.name);
      lastName = split.lastName;
      firstName = split.firstName;
    }

    return {
      lastName,
      firstName,
      department: typeof p?.department === "string" ? p.department : "",
      position: isPosition(p?.position) ? p.position : "一般職員",
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
