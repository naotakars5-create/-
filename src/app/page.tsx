"use client";

import { useEffect, useMemo, useState } from "react";
import TripFormFields from "@/components/TripFormFields";
import { getAllowance } from "@/lib/allowance";
import { loadHistory, recordHistory, tripFromHistory, uniqueValues, type TripHistoryEntry } from "@/lib/history";
import { loadProfile, saveProfile } from "@/lib/profile";
import { emptyTrip, totalAmount, tripTotal } from "@/lib/tripForm";
import { POSITIONS, type Position, type Trip, type UserProfile } from "@/lib/types";

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
}

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
  // 出力対象として選択されている出張の ID（一覧のチェックボックス）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function setAllSelected(ids: string[], on: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  // 過去に選択した出張パターンの履歴（localStorage。ブラウザ内のみ、サーバには送らない）
  const [history, setHistory] = useState<TripHistoryEntry[]>([]);
  // マウント時に保存済みの設定・履歴を復元する
  useEffect(() => {
    setProfile(loadProfile());
    setHistory(loadHistory());
  }, []);

  // 設定（氏名・所属・役職）を変更のたびにブラウザに保存する
  function updateProfile(p: UserProfile) {
    setProfile(p);
    saveProfile(p);
  }

  const total = useMemo(() => totalAmount(trips), [trips]);
  // 出力対象として選択されている出張だけを抜き出す
  const selectedTrips = useMemo(() => trips.filter((t) => selectedIds.has(t.id)), [trips, selectedIds]);

  return (
    <div className="container">
      <header>
        <h1>旅費精算書 入力アプリ</h1>
        <p>プロトタイプ / 設定・履歴はこのブラウザに保存されます</p>
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

      {tab === "settings" && <Settings profile={profile} onChange={updateProfile} />}
      {tab === "input" && (
        <InputScreen
          position={profile.position}
          history={history}
          onAddAll={(newTrips) => {
            setTrips((prev) => [...prev, ...newTrips]);
            // 追加した出張はデフォルトで出力対象に含める
            setSelectedIds((prev) => {
              const next = new Set(prev);
              newTrips.forEach((t) => next.add(t.id));
              return next;
            });
            recordHistory(newTrips);
            setHistory(loadHistory());
            setTab("list");
          }}
        />
      )}
      {tab === "list" && (
        <ListScreen
          trips={trips}
          total={total}
          onChange={setTrips}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
          onSetAllSelected={setAllSelected}
          onGoOutput={() => setTab("output")}
        />
      )}
      {tab === "output" && <OutputScreen profile={profile} selectedTrips={selectedTrips} />}
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
      <div className="notice info">
        入力した氏名・所属・役職はこのブラウザに自動保存されます。次回から入れ直す必要はありません。
      </div>
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
  history,
  onAddAll,
}: {
  position: Position;
  history: TripHistoryEntry[];
  onAddAll: (trips: Trip[]) => void;
}) {
  const [drafts, setDrafts] = useState<Trip[]>([]);
  // 履歴から選んで追加した下書きの ID。これらは日付以外をロックする（内容は登録時のまま）。
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  const historyValues = useMemo(
    () => ({
      destination: uniqueValues(history, "destination"),
      visitTo: uniqueValues(history, "visitTo"),
      purpose: uniqueValues(history, "purpose"),
      route: uniqueValues(history, "route"),
      transitCompany: uniqueValues(history, "transitCompany"),
      taxiCompany: uniqueValues(history, "taxiCompany"),
    }),
    [history]
  );

  function addFromHistory(entry: TripHistoryEntry) {
    const id = newId();
    setDrafts((prev) => [...prev, tripFromHistory(entry, id)]);
    setLockedIds((prev) => new Set(prev).add(id)); // 選んで追加したものは日付だけ変更可
  }
  function addEmpty() {
    // 日当額は現在の役職設定から初期値として補完する（0円のまま出さない）
    setDrafts((prev) => [...prev, { ...emptyTrip(), allowance: getAllowance(position) }]);
  }
  function patchDraft(id: string, patch: Partial<Trip>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function removeDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setLockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
  function unlockDraft(id: string) {
    setLockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
  function clearDrafts() {
    setDrafts([]);
    setLockedIds(new Set());
  }

  const draftsTotal = useMemo(() => totalAmount(drafts), [drafts]);

  return (
    <div>
      {history.length > 0 && (
        <div className="card">
          <label>過去に追加した出張から選ぶ（選ぶと今日の日付で追加され、日付だけ変更できます）</label>
          <div className="row">
            {history.map((h, i) => (
              <button
                key={i}
                className="btn secondary"
                onClick={() => addFromHistory(h)}
                title={h.purpose}
              >
                {h.destination}
                {h.visitTo && ` / ${h.visitTo}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <button className="btn" onClick={addEmpty}>
          ＋ 新しい出張を追加
        </button>
      </div>

      {drafts.length > 0 && (
        <>
          <div className="notice info">
            {drafts.length}件の出張候補があります。内容を確認・修正してから登録してください（自動確定はしません）。
          </div>
          {drafts.map((d, i) => {
            const locked = lockedIds.has(d.id);
            return (
              <div key={d.id} className="card">
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>候補 {i + 1}</strong>
                  <div className="row">
                    {locked && (
                      <button className="btn ghost" onClick={() => unlockDraft(d.id)}>
                        内容も修正する
                      </button>
                    )}
                    <button className="btn danger" onClick={() => removeDraft(d.id)}>
                      この項目を削除
                    </button>
                  </div>
                </div>
                <TripFormFields
                  trip={d}
                  onChange={(patch) => patchDraft(d.id, patch)}
                  historyValues={historyValues}
                  dateOnly={locked}
                />
                <div className="total">小計: {tripTotal(d).toLocaleString()} 円</div>
              </div>
            );
          })}
          <div className="card">
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <div className="total" style={{ marginRight: "auto" }}>
                候補の合計: {draftsTotal.toLocaleString()} 円
              </div>
              <button className="btn ghost" onClick={clearDrafts}>
                すべて破棄
              </button>
              <button
                className="btn"
                onClick={() => {
                  onAddAll(drafts);
                  clearDrafts();
                }}
              >
                すべてリストに追加
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ListScreen({
  trips,
  total,
  onChange,
  selectedIds,
  onToggleSelected,
  onSetAllSelected,
  onGoOutput,
}: {
  trips: Trip[];
  total: number;
  onChange: (t: Trip[]) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onSetAllSelected: (ids: string[], on: boolean) => void;
  onGoOutput: () => void;
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

  const selectedTrips = trips.filter((t) => selectedIds.has(t.id));
  const selectedCount = selectedTrips.length;
  const selectedTotal = totalAmount(selectedTrips);
  const allIds = trips.map((t) => t.id);
  const allSelected = selectedCount === trips.length;

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <span className="muted">
            登録 {trips.length} 件 ／ チェック中 <strong>{selectedCount}</strong> 件
          </span>
          <span className="total">選択の合計: {selectedTotal.toLocaleString()} 円</span>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={() => onSetAllSelected(allIds, !allSelected)}>
            {allSelected ? "すべて外す" : "すべて選択"}
          </button>
          <button className="btn" onClick={onGoOutput} disabled={selectedCount === 0}>
            チェックした {selectedCount} 件を出力する →
          </button>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          出力したい出張（例: 今月分）にチェックを入れて「出力する」を押してください。
        </div>
      </div>

      {trips.map((t) => (
        <div key={t.id} className="trip-item">
          <div className="head">
            <label className="toggle" style={{ alignItems: "flex-start", flex: 1 }}>
              <input
                type="checkbox"
                checked={selectedIds.has(t.id)}
                onChange={() => onToggleSelected(t.id)}
                style={{ marginTop: 4 }}
              />
              <span>
                <strong>
                  {t.month}/{t.day} {t.destination || "（未入力）"}
                </strong>
                <div className="muted">
                  {t.visitTo} {t.purpose && `／ ${t.purpose}`} ・ 小計 {tripTotal(t).toLocaleString()} 円
                </div>
              </span>
            </label>
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
  selectedTrips,
}: {
  profile: UserProfile;
  selectedTrips: Trip[];
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [claimDate, setClaimDate] = useState(now.toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const selectedTotal = totalAmount(selectedTrips);
  // 含まれる月ごとの件数（プレビュー表示用）
  const byMonth = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of selectedTrips) m.set(t.month, (m.get(t.month) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [selectedTrips]);

  async function generate() {
    setError(null);
    setWarnings([]);
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, trips: selectedTrips, year, claimDate }),
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
      const months = [...new Set(selectedTrips.map((t) => t.month))];
      const filename =
        months.length === 1 ? `旅費精算書_${year}_${months[0]}.xlsx` : `旅費精算書_${year}.xlsx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (selectedTrips.length === 0) {
    return (
      <div className="card muted">
        出力する出張が選択されていません。「一覧」タブで出力したい出張にチェックを入れてください。
      </div>
    );
  }

  return (
    <div className="card">
      <div className="grid2">
        <div className="field">
          <label>対象年（シートの年）</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>請求日</label>
          <input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} />
        </div>
      </div>

      <div className="notice info">
        出力対象: <strong>{selectedTrips.length} 件</strong>（
        {byMonth.map(([m, c]) => `${m}月 ${c}件`).join(" / ")}） ／ 合計{" "}
        {selectedTotal.toLocaleString()} 円
        <br />
        月ごと・前半（1〜15日）/後半（16〜31日）で自動的にシートを分けます。1シート6件を超えると超過分は警告します。
      </div>

      {error && <div className="notice error">{error}</div>}
      {warnings.map((w, i) => (
        <div key={i} className="notice error">
          ⚠ {w}
        </div>
      ))}

      <button className="btn" onClick={generate} disabled={busy}>
        {busy ? "生成中…" : "Excelを生成してダウンロード"}
      </button>
    </div>
  );
}
