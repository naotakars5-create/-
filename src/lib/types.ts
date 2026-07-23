/** 役職の一覧（日当額の決定に使用） */
export const POSITIONS = [
  "一般職員",
  "主任",
  "副参事",
  "部次長・参事",
  "部長・担当部長",
  "局長",
] as const;

export type Position = (typeof POSITIONS)[number];

/** ユーザープロフィール（ブラウザ内 state のみ。サーバには保存しない） */
export interface UserProfile {
  name: string;
  department: string;
  position: Position;
}

/** 1件の出張データ（テンプレの1ブロックに対応） */
export interface Trip {
  id: string;
  month: number; // 1-12
  day: number; // 1-31
  destination: string; // 出張先（地名） E6
  visitTo: string; // 訪問先名 E7
  purpose: string; // 用務 E8
  route: string; // 経路 G6（例: 千葉-鎌ケ谷大仏(往復)）
  fare: number | null; // 鉄道・バス運賃 H6（null = 未入力）
  fareAuto: boolean; // true = 運賃マスタ以外（Google Maps等）から自動取得した値。要確認の目印
  transitCompany: string; // 利用会社 I6
  tollParking: number; // 有料道路・駐車場代 J6
  taxi: number; // タクシー代 K6
  taxiCompany: string; // 利用会社（タクシー） L6
  payAllowance: boolean; // 日当を付けるか（デフォルト off）
  allowance: number; // 日当額 M6（payAllowance が true のとき書き込み）
  lodging: number; // 宿泊料 N6
}

/** Excel 生成リクエスト */
export interface GenerateRequest {
  profile: UserProfile;
  trips: Trip[];
  year: number; // 対象年（西暦）
  month: number; // 対象月
  claimDate: string; // 請求日 ISO (yyyy-mm-dd)
}
