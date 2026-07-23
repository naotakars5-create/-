"use client";

import { useMemo, useState } from "react";
import TripFormFields from "@/components/TripFormFields";
import { getAllowance } from "@/lib/allowance";
import { useSpeech } from "@/lib/useSpeech";
import { draftFromExtracted, emptyTrip, totalAmount, tripTotal } from "@/lib/tripForm";
import { POSITIONS, type Position, type Trip, type UserProfile } from "@/lib/types";

type Tab = "settings" | "input" | "list" | "output";

export default function Page() {
  const [tab, setTab] = useState<Tab>("settings");

  // すべてブラウザ内 state（サーバに保存しない）
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    department: "",
    position: "一般職員",
  });
  const [trips, setTrips] = useState<Trip[]>([]);

  const total = useMemo(() => totalAmount(trips), [trips]);

  return (
    <div className="container">
      <header>
        <h1>旅費精算書 音声入力アプリ</h1>
        <p>プロトタイプ / データはブラウザ内のみ・サーバ保存なし</p>
      </header>

      <nav className="tabs">
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          設定
        </button>
        <button className={tab === "input" ? "active" : ""} onClick={() => setTab("input")}>
          入力
        </button>
        <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>
          一覧（{trips.length}）
        </button>
        <button className={tab === "output" ? "active" : ""} onClick={() => setTab("output")}>
          出力
        </button>
      </nav>

      {tab === "settings" && <Settings profile={profile} onChange={setProfile} />}
      {tab === "input" && (
        <InputScreen
          position={profile.position}
          onAdd={(t) => {
            setTrips((prev) => [...prev, t]);
            setTab("list");
          }}
        />
      )}
      {tab === "list" && <ListScreen trips={trips} total={total} onChange={setTrips} />}
      {tab === "output" && <OutputScreen profile={profile} trips={trips} total={total} />}
    </div>
  );
}

function Settings({
  profile,
  onChange,
}: {
  profile: UserProfile;
  onChange: (p: UserProfile) => void;
}) {
  return (
    <div className="card">
      <div className="grid2">
        <div className="field">
          <label>氏名</label>
          <input
            value={profile.name}
            onChange={(e) => onChange({ ...profile, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>所属</label>
          <input
            value={profile.department}
            onChange={(e) => onChange({ ...profile, department: e.target.value })}
          />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>役職</label>
          <select
            value={profile.position}
            onChange={(e) => onChange({ ...profile, position: e.target.value as Position })}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>日当額（役職より自動）</label>
          <input value={`${getAllowance(profile.position)} 円`} disabled />
        </div>
      </div>
    </div>
  );
}

function InputScreen({
  position,
  onAdd,
}: {
  position: Position;
  onAdd: (t: Trip) => void;
}) {
  const speech = useSpeech();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Trip | null>(null);

  async function extract() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speech.transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "抽出に失敗しました");

      let draft = draftFromExtracted(data.extracted, position);

      // 運賃マスタでヒットしなければ、Google Maps 経路検索で運賃取得を試みる。
      // 見つからなくても致命的ではない（従来どおり空欄で手入力）。
      const { routeFrom, routeTo, roundTrip } = data.extracted;
      if (draft.fare == null && routeFrom && routeTo) {
        try {
          const fareRes = await fetch("/api/fare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: routeFrom, to: routeTo, roundTrip }),
          });
          const fareData = await fareRes.json();
          if (fareRes.ok && typeof fareData.fare === "number") {
            draft = { ...draft, fare: fareData.fare, fareAuto: true };
          }
        } catch {
          // 運賃検索の失敗は無視し、従来どおり手入力に任せる
        }
      }

      setDraft(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "抽出に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "center", marginBottom: 12 }}>
          <button
            className={`btn mic ${speech.recording ? "recording" : ""}`}
            onClick={() => (speech.recording ? speech.stop() : speech.start())}
            title={speech.recording ? "停止" : "録音開始"}
          >
            {speech.recording ? "■" : "🎤"}
          </button>
        </div>
        {!speech.supported && (
          <div className="notice error">
            このブラウザは音声入力に非対応です。下のテキスト欄に手入力してください（手入力でも動作します）。
          </div>
        )}
        {speech.error && <div className="notice error">{speech.error}</div>}

        <div className="field">
          <label>認識テキスト（編集可）</label>
          <textarea
            value={speech.transcript}
            placeholder="例: 6月12日、鎌ケ谷巧業に顧客打ち合わせ、千葉から鎌ケ谷大仏往復"
            onChange={(e) => speech.setTranscript(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="btn" onClick={extract} disabled={loading || !speech.transcript.trim()}>
            {loading ? "抽出中…" : "AIで項目を抽出"}
          </button>
          <button className="btn ghost" onClick={() => speech.reset()}>
            クリア
          </button>
          <button className="btn secondary" onClick={() => setDraft(emptyTrip())}>
            手入力で追加
          </button>
        </div>
        {error && (
          <div className="notice error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>

      {draft && (
        <div className="card">
          <div className="notice info">
            内容を確認・修正してから登録してください（自動確定はしません）。
          </div>
          <TripFormFields trip={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <div className="total" style={{ marginRight: "auto" }}>
              小計: {tripTotal(draft).toLocaleString()} 円
            </div>
            <button className="btn ghost" onClick={() => setDraft(null)}>
              破棄
            </button>
            <button
              className="btn"
              onClick={() => {
                onAdd(draft);
                setDraft(null);
                speech.reset();
              }}
            >
              リストに追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ListScreen({
  trips,
  total,
  onChange,
}: {
  trips: Trip[];
  total: number;
  onChange: (t: Trip[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function patch(id: string, p: Partial<Trip>) {
    onChange(trips.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }
  function remove(id: string) {
    onChange(trips.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

  if (trips.length === 0) {
    return <div className="card muted">まだ出張が登録されていません。「入力」タブから追加してください。</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">登録件数: {trips.length}</span>
          <span className="total">合計プレビュー: {total.toLocaleString()} 円</span>
        </div>
      </div>

      {trips.map((t) => (
        <div key={t.id} className="trip-item">
          <div className="head">
            <div>
              <strong>
                {t.month}/{t.day} {t.destination || "（未入力）"}
              </strong>
              <div className="muted">
                {t.visitTo} {t.purpose && `／ ${t.purpose}`} ・ 小計 {tripTotal(t).toLocaleString()} 円
              </div>
            </div>
            <div className="row">
              <button
                className="btn ghost"
                onClick={() => setEditingId(editingId === t.id ? null : t.id)}
              >
                {editingId === t.id ? "閉じる" : "編集"}
              </button>
              <button className="btn danger" onClick={() => remove(t.id)}>
                削除
              </button>
            </div>
          </div>
          {editingId === t.id && (
            <div style={{ marginTop: 12 }}>
              <TripFormFields trip={t} onChange={(p) => patch(t.id, p)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OutputScreen({
  profile,
  trips,
  total,
}: {
  profile: UserProfile;
  trips: Trip[];
  total: number;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [claimDate, setClaimDate] = useState(now.toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const targetTrips = trips.filter((t) => t.month === month);

  async function generate() {
    setError(null);
    setWarnings([]);
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, trips, year, month, claimDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "生成に失敗しました");
      }
      const warnHeader = res.headers.get("X-Warnings");
      if (warnHeader) {
        try {
          setWarnings(JSON.parse(decodeURIComponent(warnHeader)));
        } catch {
          /* ignore */
        }
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `旅費精算書_${year}_${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="grid3">
        <div className="field">
          <label>対象年</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>対象月</label>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>請求日</label>
          <input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} />
        </div>
      </div>

      <div className="notice info">
        {month}月の対象出張: {targetTrips.length} 件 ／ 全体合計: {total.toLocaleString()} 円
        <br />
        前半（1〜15日）と後半（16〜31日）で自動的にシートを分けます。1シート6件を超えると次シートへ、それも超えると警告します。
      </div>

      {error && <div className="notice error">{error}</div>}
      {warnings.map((w, i) => (
        <div key={i} className="notice error">
          ⚠ {w}
        </div>
      ))}

      <button className="btn" onClick={generate} disabled={busy || targetTrips.length === 0}>
        {busy ? "生成中…" : "Excelを生成してダウンロード"}
      </button>
    </div>
  );
}
