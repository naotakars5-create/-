"use client";

import { useId, useState } from "react";
import { emptyLeg } from "@/lib/fare";
import type { RouteLeg, Trip } from "@/lib/types";

/** 用務の選択肢（「その他」を選ぶと自由入力になる） */
const PURPOSE_PRESETS = ["顧客打ち合わせ", "ロケ"] as const;

/** 利用会社（コインパーキング等）の選択肢（「その他」を選ぶと自由入力になる） */
const PARKING_COMPANY_PRESETS = [
  "株式会社アップルパーク",
  "スターツアメニティー株式会社",
  "三井不動産リアルティ",
  "大和ハウスパーキング",
  "日本パーキング株式会社",
  "株式会社パーキング365",
  "NEXCO東日本",
  "和光ファーム株式会社",
  "タイムズ２４株式会社",
  "㈱第一興商",
  "ティエムピー",
  "新明和工業",
  "㈱イーシーインター",
  "INGパーク",
  "千葉県道路公社",
] as const;

/** 入力欄のオートコンプリート候補（履歴から集めたユニーク値。省略時は候補なし） */
interface HistoryValues {
  destination?: string[];
  visitTo?: string[];
  purpose?: string[];
  station?: string[];
  tollParkingCompany?: string[];
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

  // 利用会社: 現在値がプリセット以外（かつ空でない）なら「その他」の自由入力とみなす
  const companyIsPreset = (PARKING_COMPANY_PRESETS as readonly string[]).includes(
    trip.tollParkingCompany
  );
  const [companyOther, setCompanyOther] = useState(
    !companyIsPreset && trip.tollParkingCompany !== ""
  );
  const companySelectValue = companyOther
    ? "その他"
    : companyIsPreset
      ? trip.tollParkingCompany
      : "";
  function handleCompanySelect(v: string) {
    if (v === "その他") {
      setCompanyOther(true);
      onChange({ tollParkingCompany: "" }); // 自由入力欄に入れてもらうため一旦クリア
    } else {
      setCompanyOther(false);
      onChange({ tollParkingCompany: v }); // プリセット、または「選択してください」なら空
    }
  }

  // --- 経路（複数区間）の操作 ---
  const routes = trip.routes.length > 0 ? trip.routes : [emptyLeg()];
  function patchLeg(index: number, patch: Partial<RouteLeg>) {
    onChange({
      routes: routes.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    });
  }
  function addLeg() {
    onChange({ routes: [...routes, emptyLeg()] });
  }
  function removeLeg(index: number) {
    const next = routes.filter((_, i) => i !== index);
    onChange({ routes: next.length > 0 ? next : [emptyLeg()] });
  }

  const dl = {
    destination: `${uid}-destination`,
    visitTo: `${uid}-visitTo`,
    purpose: `${uid}-purpose`,
    station: `${uid}-station`,
    tollParkingCompany: `${uid}-tollParkingCompany`,
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

      {/* 鉄道・バス経路（駅名2つ＋往復＋運賃を1区間として、複数追加できる） */}
      <div className="field">
        <label>鉄道・バス経路（出発駅 − 到着駅 と運賃）</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {routes.map((leg, i) => (
            <div key={i} className="route-leg">
              <div className="route-leg-line">
                <input
                  className="route-station"
                  value={leg.from}
                  list={dl.station}
                  disabled={lock}
                  placeholder="出発駅（例: 千葉）"
                  aria-label="出発駅"
                  onChange={(e) => patchLeg(i, { from: e.target.value })}
                />
                <span className="route-dash" aria-hidden>
                  −
                </span>
                <input
                  className="route-station"
                  value={leg.to}
                  list={dl.station}
                  disabled={lock}
                  placeholder="到着駅（例: 品川）"
                  aria-label="到着駅"
                  onChange={(e) => patchLeg(i, { to: e.target.value })}
                />
                <div className="route-fare-wrap">
                  <div className="route-fare-row">
                    <input
                      className="route-fare"
                      type="number"
                      value={leg.fare ?? ""}
                      disabled={lock}
                      placeholder="運賃"
                      aria-label="運賃（円・片道）"
                      onChange={(e) =>
                        patchLeg(i, { fare: e.target.value === "" ? null : num(e.target.value) })
                      }
                    />
                    <span className="muted route-yen">円</span>
                  </div>
                  <span className="route-fare-hint">片道運賃</span>
                </div>
                {routes.length > 1 && !lock && (
                  <button
                    type="button"
                    className="btn danger route-remove"
                    onClick={() => removeLeg(i)}
                    title="この区間を削除"
                    aria-label="この区間を削除"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="route-roundtrip-row">
                <label className="toggle route-roundtrip">
                  <input
                    type="checkbox"
                    checked={leg.roundTrip}
                    disabled={lock}
                    onChange={(e) => patchLeg(i, { roundTrip: e.target.checked })}
                  />
                  往復
                </label>
                <span className="route-roundtrip-note">
                  チェックすると料金が2倍で計上されます
                </span>
              </div>
            </div>
          ))}
        </div>
        <DataList id={dl.station} values={historyValues?.station} />
        {!lock && (
          <button
            type="button"
            className="btn secondary"
            style={{ marginTop: 10 }}
            onClick={addLeg}
          >
            ＋ 経路を追加
          </button>
        )}
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
          <label>利用会社（コインパーキング等）</label>
          <select
            value={companySelectValue}
            disabled={lock}
            onChange={(e) => handleCompanySelect(e.target.value)}
          >
            <option value="">選択してください</option>
            {PARKING_COMPANY_PRESETS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="その他">その他</option>
          </select>
          {companyOther && (
            <input
              style={{ marginTop: 6 }}
              value={trip.tollParkingCompany}
              list={dl.tollParkingCompany}
              disabled={lock}
              placeholder="会社名を入力"
              onChange={(e) => onChange({ tollParkingCompany: e.target.value })}
            />
          )}
          <DataList id={dl.tollParkingCompany} values={historyValues?.tollParkingCompany} />
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
  );
}
