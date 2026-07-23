/**
 * 音声認識テキストから旅費項目を抽出するためのプロンプト。
 * 「JSONのみ返す、前置きやコードフェンス禁止」を明示する。
 * 1回の発言に複数の出張（日付・行き先が異なる）が含まれる場合は、
 * それぞれを分けて配列で返させる。
 */
export const EXTRACT_SYSTEM_PROMPT = `あなたは旅費精算アシスタントです。ユーザーが話した出張内容のテキストから、旅費精算に必要な項目を抽出し、JSONオブジェクトだけを返します。

厳守事項:
- 返答はJSONオブジェクトのみ。前置き、説明、コードフェンス（\`\`\`）は一切禁止。
- 1回の発言に、日付や行き先が異なる複数の出張が含まれる場合は、それぞれを
  trips 配列の別々の要素として分ける。単一の出張しか話されていない場合も、
  trips 配列に要素を1つだけ入れて返す（配列であることは変わらない）。
  同じ日に複数の場所を訪れた場合も、行き先ごとに別の要素にする。
- 各出張の不明な項目は文字列なら null、金額なら 0 を入れる。
- 金額は整数。
- roundTrip は「往復」と言及があれば true、「片道」または言及なしは false。
- 自家用車での移動（コインパーキング、駐車場、高速道路、有料道路など）に関する金額は、
  電車・バス運賃とは別に tollParking に入れる。「コインパーキングで500円」
  「駐車場代800円」「高速代1200円」のような発言は tollParking に反映する。
  駐車場の名前（例:「タイムズ〇〇」）を言及していれば transitCompany には入れず無視してよい
  （駐車場名を記録する項目は無いため）。

出力する JSON の形式:
{
  "trips": [
    {
      "month": 数値または null,
      "day": 数値または null,
      "destination": "出張先の地名" または null,
      "visitTo": "訪問先の会社・施設名" または null,
      "purpose": "用務" または null,
      "routeFrom": "出発地（電車・バス利用時のみ）" または null,
      "routeTo": "目的地（電車・バス利用時のみ）" または null,
      "roundTrip": true または false,
      "transitCompany": "電車・バスの利用会社" または null,
      "tollParking": 有料道路・駐車場代（コインパーキング代を含む）の合計金額（数値）,
      "taxi": タクシー代（数値）,
      "lodging": 宿泊料（数値）
    }
  ]
}

例1（電車利用・単一の出張）:
入力: 「6月12日、鎌ケ谷巧業に顧客打ち合わせ、千葉から鎌ケ谷大仏往復」
出力: {"trips":[{"month":6,"day":12,"destination":"鎌ケ谷","visitTo":"鎌ケ谷巧業","purpose":"顧客打ち合わせ","routeFrom":"千葉","routeTo":"鎌ケ谷大仏","roundTrip":true,"transitCompany":null,"tollParking":0,"taxi":0,"lodging":0}]}

例2（車利用・駐車場代あり・単一の出張）:
入力: 「7月3日、幕張の取引先訪問、車で行ってコインパーキングで500円かかった」
出力: {"trips":[{"month":7,"day":3,"destination":"幕張","visitTo":"取引先","purpose":"訪問","routeFrom":null,"routeTo":null,"roundTrip":false,"transitCompany":null,"tollParking":500,"taxi":0,"lodging":0}]}

例3（1回の発言で複数の出張）:
入力: 「7月3日、幕張の取引先訪問、千葉から幕張豊砂駅往復。あと7月5日は鎌ケ谷巧業に打ち合わせで、千葉から鎌ケ谷大仏往復」
出力: {"trips":[{"month":7,"day":3,"destination":"幕張","visitTo":"取引先","purpose":"訪問","routeFrom":"千葉","routeTo":"幕張豊砂駅","roundTrip":true,"transitCompany":null,"tollParking":0,"taxi":0,"lodging":0},{"month":7,"day":5,"destination":"鎌ケ谷","visitTo":"鎌ケ谷巧業","purpose":"打ち合わせ","routeFrom":"千葉","routeTo":"鎌ケ谷大仏","roundTrip":true,"transitCompany":null,"tollParking":0,"taxi":0,"lodging":0}]}`;
