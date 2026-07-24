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
  name: string; // 氏名（姓名をまとめて1つ）
  department: string;
  position: Position;
  carUnitPrice: number; // 自家用車の単価（円/km）。ガソリン代で毎月変わるので都度更新する
}

/** 鉄道・バス経路の1区間（出発駅・到着駅・往復・運賃） */
export interface RouteLeg {
  from: string; // 出発駅（例: 千葉）
  to: string; // 到着駅（例: 品川）
  roundTrip: boolean; // 往復なら true（出力は「千葉-品川(往復)」）
  fare: number | null; // 運賃（円, null = 未入力）
}

/** 1件の出張データ（テンプレの1ブロックに対応） */
export interface Trip {
  id: string;
  month: number; // 1-12
  day: number; // 1-31
  destination: string; // 出張先（地名） E6
  visitTo: string; // 訪問先名 E7
  purpose: string; // 用務 E8
  routes: RouteLeg[]; // 鉄道・バス経路（複数区間可）。各区間が G/H 列の1行に対応
  carDistanceKm: number; // 自家用車の移動距離（km）。金額 = 距離 × 単価
  carUnitPrice: number; // 自家用車の単価（円/km）。入力時点の設定値を保持
  tollParking: number; // 有料道路・駐車場代 J6（主にコインパーキング）
  tollParkingCompany: string; // 利用会社 L6（コインパーキング等の利用会社）
  taxi: number; // タクシー代 K6
  payAllowance: boolean; // 日当を付けるか（デフォルト off）
  allowance: number; // 日当額 M6（payAllowance が true のとき書き込み）
}

/** Excel 生成リクエスト。trips は「出力対象として選択された出張」。 */
export interface GenerateRequest {
  profile: UserProfile;
  trips: Trip[];
  year: number; // 対象年（西暦）。シート名 YYYY_M_half の年に使う
  claimDate: string; // 請求日 ISO (yyyy-mm-dd)
}
