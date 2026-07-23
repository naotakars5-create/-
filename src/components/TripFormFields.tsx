"use client";

import type { Trip } from "@/lib/types";

interface Props {
  trip: Trip;
  onChange: (patch: Partial<Trip>) => void;
}

/** 出張1件の編集フォーム（確認画面・一覧編集で共用） */
export default function TripFormFields({ trip, onChange }: Props) {
  const num = (v: string) => (v === "" ? 0 : Math.round(Number(v)) || 0);
  return (
    <div>
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
            onChange={(e) => onChange({ destination: e.target.value })}
          />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>訪問先名</label>
          <input value={trip.visitTo} onChange={(e) => onChange({ visitTo: e.target.value })} />
        </div>
        <div className="field">
          <label>用務</label>
          <input value={trip.purpose} onChange={(e) => onChange({ purpose: e.target.value })} />
        </div>
      </div>

      <div className="field">
        <label>経路</label>
        <input value={trip.route} onChange={(e) => onChange({ route: e.target.value })} />
      </div>

      <div className="grid2">
        <div className="field">
          <label>鉄道・バス運賃（円）{trip.fare == null && " ※マスタ未ヒット・要手入力"}</label>
          <input
            type="number"
            value={trip.fare ?? ""}
            placeholder="手入力"
            onChange={(e) =>
              onChange({
                fare: e.target.value === "" ? null : num(e.target.value),
                fareAuto: false, // 手入力で上書きしたら「要確認」表示は消す
              })
            }
          />
          {trip.fareAuto && (
            <div className="notice info" style={{ marginTop: 6, padding: "6px 10px" }}>
              🔍 Google マップの経路検索から自動取得した金額です。念のためご確認ください。
            </div>
          )}
        </div>
        <div className="field">
          <label>利用会社</label>
          <input
            value={trip.transitCompany}
            onChange={(e) => onChange({ transitCompany: e.target.value })}
          />
        </div>
      </div>

      <div className="grid3">
        <div className="field">
          <label>有料道路・駐車場代</label>
          <input
            type="number"
            value={trip.tollParking}
            onChange={(e) => onChange({ tollParking: num(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>タクシー代</label>
          <input
            type="number"
            value={trip.taxi}
            onChange={(e) => onChange({ taxi: num(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>利用会社（タクシー）</label>
          <input
            value={trip.taxiCompany}
            onChange={(e) => onChange({ taxiCompany: e.target.value })}
          />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>宿泊料</label>
          <input
            type="number"
            value={trip.lodging}
            onChange={(e) => onChange({ lodging: num(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>日当（役職より自動: {trip.allowance}円）</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={trip.payAllowance}
              onChange={(e) => onChange({ payAllowance: e.target.checked })}
            />
            日当を付ける
          </label>
        </div>
      </div>
    </div>
  );
}
