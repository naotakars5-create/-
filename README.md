# 旅費精算書 音声入力アプリ（プロトタイプ）

社員が音声で話した内容から、既存の Excel 様式「旅費精算書」に自動で値を書き込み、
ダウンロードできる Web アプリの試作。

## 技術スタック

- Next.js (App Router) + TypeScript
- 音声入力: Web Speech API（ブラウザ標準・Chrome 想定）
- 構造化: OpenAI API (`gpt-4o-mini`) にテキストを渡して JSON 抽出
- 運賃自動取得: 運賃マスタにヒットしない区間は Google Maps Directions API（経路検索）で補完（任意設定）
- Excel 書き込み: Node の `exceljs`（数式・書式・結合セルを壊さず、指定セルに値のみ書き込み）
- PC / スマホ両対応のレスポンシブ

## セットアップ

```bash
npm install
cp .env.example .env.local   # OPENAI_API_KEY を設定（GOOGLE_MAPS_API_KEY は任意）
npm run dev                  # http://localhost:3000
```

## 開発の進め方（仕様どおりの順序）

1. **Excel 書き込みを CLI で確立**（UI より先）

   ```bash
   npm run template     # templates/template.xlsx を生成（数式・結合セル込み）
   npm run test:write   # サンプル出張を書き込み output/sample.xlsx を生成
   npm run test:verify  # 数式・結合セル・入力値を自動検証
   ```

   `output/sample.xlsx` を Excel で開き、体裁・数式が崩れていないことを確認できる。

2. **Web UI をかぶせる**（設定 → 入力 → 一覧 → 出力）
3. **音声入力**（手入力でも動く状態が先。音声は最後）

## 様式の実装メモ

- 1 シート = 半月分。シート名 `YYYY_M_1`（前半 1〜15 日）/ `YYYY_M_2`（後半 16〜31 日）
- 1 件 = 5 行ブロック（開始行 6, 11, 16, 21, 26, 31、最大 6 件/シート）
- 数式セル・結合セルの非アンカー・固定ラベル（`B6="/"` など）には**書き込まない**
- 既存ファイルで欠落していた `H25 = SUM(H21:H24)` はテンプレ生成時に補完済み
- 金額は整数、日当は役職から自動決定

### 分離された差し替えポイント（将来対応）

- `getFare(from, to, roundTrip)` … 運賃マスタ（`src/lib/fareMaster.json`）。ヒットしない区間は
  `/api/fare`（Google Maps Directions API）で自動補完を試みる。それも失敗すれば従来どおり
  空欄で手入力させる（精算金額に関わるため、失敗時に推測値は出さない）。
  自動取得した値は `Trip.fareAuto = true` となり、確認画面に「要確認」表示が出る。
  ユーザーが手動で金額を修正すると `fareAuto` は自動的に false に戻る。
- `shouldPayAllowance(trip)` … 日当支給条件。現状は常に false（UI トグル）。ルール確定後に自動判定へ

## テンプレート .xlsx について

リポジトリに実測済みの既存テンプレ `.xlsx` が無いため、`src/lib/excel/template.ts` が
仕様書のセル配置どおりにコードで再現する。実ファイルが用意できたら
`templates/template.xlsx` に置くだけで、書き込み処理（`writeTrips.ts`）はそのまま動く。

## 音声入力フロー

1. マイクボタンで録音 → Web Speech API でテキスト化
2. `/api/extract` が OpenAI API で JSON 抽出（「JSON のみ返す」をプロンプトで明示）
3. 運賃マスタ・役職から補完し、**確認画面で全項目を表示・修正**（自動確定なし）
4. 確定でリストに追加 → 「出力」タブで対象月を選び Excel をダウンロード

## プライバシー

個人情報を含むため、プロトタイプ段階ではデータはブラウザ内 state のみ。サーバに保存しない。
（全社展開フェーズで認証込みで設計する）
