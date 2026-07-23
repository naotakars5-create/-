"use client";

import { useId, useState } from "react";
import type { Trip } from "@/lib/types";

/** 用務の選択肢（「その他」を選ぶと自由入力になる） */
const PURPOSE_PRESETS = ["顧客打ち合わせ", "ロケ"] as const;

/** 入力欄のオートコンプリート候補（履歴から集めたユニーク値。省略時は候補なし） */
interface HistoryValues {
  destination?: string[];
  visitTo?: string[];
  purpose?: string[];
  route?: string[];
  transitCompany?: string[];
  taxiCompany?: string[];
}

interface Props {
  trip: Trip;
  onChange: (patch: Partial<Trip>) => void;
  historyValues?: HistoryValues;
  /** true のとき、日付（月・日）以外の項目を編集不可にする（履歴から選んだ出張向け） */
  dateOnly?: boolean;
}

function DataList({ id, values }: { id: string; values?: string[] }) {
  if (!values || values.length === 0) return null;
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );
}

/** 出張1件の編集フォーム（確認画面・一覧編集で共用） */
export default function TripFormFields({ trip, onChange, historyValues, dateOnly }: Props) {
  const num = (v: string) => (v === "" ? 0 : Math.round(Number(v)) || 0);
  const lock = dateOnly === true; // 日付以外をロックするか
  const uid = useId();

  // 用務: 現在値がプリセット以外（かつ空でない）なら「その他」の自由入力とみなす
  const purposeIsPreset = (PURPOSE_PRESETS as readonly string[]).includes(trip.purpose);
  const [purposeOther, setPurposeOther] = useState(!purposeIsPreset && trip.purpose !== "");
  const purposeSelectValue = purposeOther ? "その他" : purposeIsPreset ? trip.purpose : "";
  function handlePurposeSelect(v: string) {
    if (v === "その他") {
      setPurposeOther(true);
      onChange({ purpose: "" }); // 自由入力欄に入れてもらうため一旦クリア
    } else {
      setPurposeOther(false);
      onChange({ purpose: v }); // プリセット、または「選択してください」なら空
    }
  }

  const dl = {
    destination: `${uid}-destination`,
    visitTo: `${uid}-visitTo`,
    purpose: `${uid}-purpose`,
    route: `${uid}-route`,
    transitCompany: `${uid}-transitCompany`,
    taxiCompany: `${uid}-taxiCompany`,
  };
  return (
    <div>
      {lock && (
        <div className="notice info" style={{ marginBottom: 12 }}>
          📌 履歴から選んだ出張です。<strong>日付だけ</strong>変更できます（内容は登録時のまま）。
          内容も直したい場合は下の「内容も修正する」を押してください。
        </div>
      )}
      <div className="grid3">
        <div className="field">
          <label>月</label>
          <input
            type="number"
            value={trip.month}
            min={1}
            max={12}
            onChange={(e) => onChange({ month: num(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>日</label>
          <input
            type="number"
            value={trip.day}
            min={1}
            max={31}
            onChange={(e) => onChange({ day: num(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>出張先（地名）</label>
          <input
            value={trip.destination}
            list={dl.destination}
            disabled={lock}
            onChange={(e) => onChange({ destination: e.target.value })}
          />
          <DataList id={dl.destination} values={historyValues?.destination} />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>訪問先名</label>
          <input
            value={trip.visitTo}
            list={dl.visitTo}
            disabled={lock}
            onChange={(e) => onChange({ visitTo: e.target.value })}
          />
          <DataList id={dl.visitTo} values={historyValues?.visitTo} />
        </div>
        <div className="field">
          <label>用務</label>
          <select
            value={purposeSelectValue}
            disabled={lock}
            onChange={(e) => handlePurposeSelect(e.target.value)}
          >
            <option value="">選択してください</option>
            <option value="顧客打ち合わせ">顧客打ち合わせ</option>
            <option value="ロケ">ロケ</option>
            <option value="その他">その他</option>
          </select>
          {purposeOther && (
            <input
              style={{ marginTop: 6 }}
              value={trip.purpose}
              list={dl.purpose}
              disabled={lock}
              placeholder="用務を入力"
              onChange={(e) => onChange({ purpose: e.target.value })}
            />
          )}
          <DataList id={dl.purpose} values={historyValues?.purpose} />
        </div>
      </div>

      <div className="field">
        <label>経路</label>
        <input
          value={trip.route}
          list={dl.route}
          disabled={lock}
          onChange={(e) => onChange({ route: e.target.value })}
        />
        <DataList id={dl.route} values={historyValues?.route} />
      </div>

      <div className="grid2">
        <div className="field">
          <label>鉄道・バス運賃（円）{trip.fare == null && !lock && " ※マスタ未ヒット・要手入力"}</label>
          <input
            type="number"
            value={trip.fare ?? ""}
            placeholder="手入力"
            disabled={lock}
            onChange={(e) =>
              onChange({
                fare: e.target.value === "" ? null : num(e.target.value),
                fareAuto: false, // 手入力で上書きしたら「要確認」表示は消す
              })
            }
          />
          {trip.fareAuto && !lock && (
            <div className="notice info" style={{ marginTop: 6, padding: "6px 10px" }}>
              🔍 Google マップの経路検索から自動取得した金額です。念のためご確認ください。
            </div>
          )}
        </div>
        <div className="field">
          <label>利用会社</label>
          <input
            value={trip.transitCompany}
            list={dl.transitCompany}
            disabled={lock}
            onChange={(e) => onChange({ transitCompany: e.target.value })}
          />
          <DataList id={dl.transitCompany} values={historyValues?.transitCompany} />
        </div>
      </div>

      <div className="grid3">
        <div className="field">
          <label>有料道路・駐車場代</label>
          <input
            type="number"
            value={trip.tollParking}
            disabled={lock}
            onChange={(e) => onChange({ tollParking: num(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>タクシー代</label>
          <input
            type="number"
            value={trip.taxi}
            disabled={lock}
            onChange={(e) => onChange({ taxi: num(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>利用会社（タクシー）</label>
          <input
            value={trip.taxiCompany}
            list={dl.taxiCompany}
            disabled={lock}
            onChange={(e) => onChange({ taxiCompany: e.target.value })}
          />
          <DataList id={dl.taxiCompany} values={historyValues?.taxiCompany} />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>宿泊料</label>
          <input
            type="number"
            value={trip.lodging}
            disabled={lock}
            onChange={(e) => onChange({ lodging: num(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>日当（役職より自動: {trip.allowance}円）</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={trip.payAllowance}
              disabled={lock}
              onChange={(e) => onChange({ payAllowance: e.target.checked })}
            />
            日当を付ける
          </label>
        </div>
      </div>
    </div>
  );
}
