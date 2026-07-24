"use client";

import { useEffect, useMemo, useState } from "react";
import TripFormFields from "@/components/TripFormFields";
import { getAllowance } from "@/lib/allowance";
import {
  loadHistory,
  MAX_HISTORY_ENTRIES,
  recordHistory,
  removeHistory,
  tripFromHistory,
  uniqueStations,
  uniqueValues,
  type TripHistoryEntry,
} from "@/lib/history";
import { loadProfile, saveProfile } from "@/lib/profile";
import {
  clearOutputHistory,
  loadOutputHistory,
  recordOutput,
  removeOutputAt,
  type OutputHistoryEntry,
} from "@/lib/outputHistory";
import { loadTripsState, saveTripsState } from "@/lib/tripStore";
import { buildRoute } from "@/lib/fare";
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
  // localStorage からの復元が完了したか（完了前に空の状態で上書き保存しないためのフラグ）
  const [hydrated, setHydrated] = useState(false);
  // マウント時に保存済みの設定・履歴・一覧を復元する
  useEffect(() => {
    setProfile(loadProfile());
    setHistory(loadHistory());
    const saved = loadTripsState();
    setTrips(saved.trips);
    setSelectedIds(new Set(saved.selectedIds));
    setHydrated(true);
  }, []);

  // 一覧（登録済み出張）と選択状態は、変更のたびにブラウザに保存して次回も残す
  useEffect(() => {
    if (!hydrated) return;
    saveTripsState(trips, [...selectedIds]);
  }, [trips, selectedIds, hydrated]);

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
          onDeleteHistory={(entry) => setHistory(removeHistory(entry))}
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
          onDeleteAll={() => {
            setTrips([]);
            setSelectedIds(new Set());
          }}
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
            placeholder="例: 山田 太郎"
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
  onDeleteHistory,
}: {
  position: Position;
  history: TripHistoryEntry[];
  onAddAll: (trips: Trip[]) => void;
  onDeleteHistory: (entry: TripHistoryEntry) => void;
}) {
  const [drafts, setDrafts] = useState<Trip[]>([]);
  // 履歴から選んで追加した下書きの ID。これらは日付以外をロックする（内容は登録時のまま）。
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  // 履歴の「管理（削除）モード」。ON のとき、各履歴に削除ボタンを出す。
  const [manageHistory, setManageHistory] = useState(false);

  const historyValues = useMemo(
    () => ({
      destination: uniqueValues(history, "destination"),
      visitTo: uniqueValues(history, "visitTo"),
      purpose: uniqueValues(history, "purpose"),
      station: uniqueStations(history),
      tollParkingCompany: uniqueValues(history, "tollParkingCompany"),
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
          <div className="row" style={{ justifyContent: "space-between" }}>
            <label style={{ marginBottom: 0 }}>
              過去に追加した出張から選ぶ
              {manageHistory
                ? "（不要なものは「削除」で消せます）"
                : "（選ぶと今日の日付で追加され、日付だけ変更できます）"}
              <span className="muted" style={{ display: "block", fontSize: "0.8rem", fontWeight: 400, marginTop: 2 }}>
                ※ よく使う出張を最大{MAX_HISTORY_ENTRIES}件まで自動で保存します（新しいものが優先されます）。
              </span>
            </label>
            <button
              className="btn ghost"
              onClick={() => setManageHistory((v) => !v)}
              style={{ padding: "6px 12px", minHeight: "auto" }}
            >
              {manageHistory ? "完了" : "履歴を編集"}
            </button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {history.map((h, i) =>
              manageHistory ? (
                <span
                  key={i}
                  className="row"
                  style={{
                    gap: 0,
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ padding: "8px 10px", fontSize: "0.9rem" }}>
                    {h.destination}
                    {h.visitTo && ` / ${h.visitTo}`}
                  </span>
                  <button
                    className="btn danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          `「${h.destination}${h.visitTo ? " / " + h.visitTo : ""}」を履歴から削除しますか？`
                        )
                      ) {
                        onDeleteHistory(h);
                      }
                    }}
                    style={{ borderRadius: 0, border: "none", borderLeft: "1px solid var(--border-strong)" }}
                    title="この履歴を削除"
                  >
                    削除
                  </button>
                </span>
              ) : (
                (() => {
                  const routeText = h.routes
                    .map((l) => buildRoute(l.from, l.to, l.roundTrip))
                    .filter(Boolean)
                    .join("、");
                  const amount = tripTotal(h);
                  const sub = [routeText, `${amount.toLocaleString()}円`]
                    .filter(Boolean)
                    .join(" ・ ");
                  return (
                    <button
                      key={i}
                      className="btn secondary history-chip"
                      onClick={() => addFromHistory(h)}
                      title={`${h.destination}${h.visitTo ? " / " + h.visitTo : ""}\n${routeText}\n${amount.toLocaleString()}円${h.purpose ? "\n" + h.purpose : ""}`}
                    >
                      <span className="history-chip-main">
                        {h.destination}
                        {h.visitTo && ` / ${h.visitTo}`}
                      </span>
                      <span className="history-chip-sub">{sub}</span>
                    </button>
                  );
                })()
              )
            )}
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
  onDeleteAll,
}: {
  trips: Trip[];
  total: number;
  onChange: (t: Trip[]) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onSetAllSelected: (ids: string[], on: boolean) => void;
  onGoOutput: () => void;
  onDeleteAll: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function patch(id: string, p: Partial<Trip>) {
    onChange(trips.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }
  function remove(id: string) {
    onChange(trips.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }
  const clampNum = (v: string, lo: number, hi: number) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  };
  const dateInputStyle = {
    width: 56,
    minHeight: 0,
    padding: "6px 8px",
    textAlign: "center" as const,
  };

  if (trips.length === 0) {
    return <div className="card muted">まだ出張が登録されていません。「入力」タブから追加してください。</div>;
  }

  // 表示は月→日の昇順に自動で並べ替える（7月1日が上、7月31日が下）
  const sortedTrips = [...trips].sort((a, b) => a.month - b.month || a.day - b.day);
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
        <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => onSetAllSelected(allIds, !allSelected)}>
            {allSelected ? "すべて外す" : "すべて選択"}
          </button>
          <button className="btn" onClick={onGoOutput} disabled={selectedCount === 0}>
            チェックした {selectedCount} 件を出力する →
          </button>
          <button
            className="btn danger"
            style={{ marginLeft: "auto" }}
            onClick={() => {
              if (window.confirm(`登録済みの ${trips.length} 件をすべて削除しますか？（この操作は元に戻せません）`)) {
                onDeleteAll();
              }
            }}
          >
            すべて削除
          </button>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          出力したい出張（例: 今月分）にチェックを入れて「出力する」を押してください。
        </div>
      </div>

      {sortedTrips.map((t) => (
        <div key={t.id} className="trip-item">
          <div className="head">
            <input
              type="checkbox"
              checked={selectedIds.has(t.id)}
              onChange={() => onToggleSelected(t.id)}
              aria-label="出力対象に含める"
              style={{ width: 20, height: 20, minHeight: 0, padding: 0, flex: "0 0 auto" }}
            />
            <div style={{ flex: 1 }}>
              {/* その場で日付だけ変更できる（月・日） */}
              <div className="row" style={{ gap: 6, alignItems: "center" }}>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={t.month}
                  aria-label="月"
                  style={dateInputStyle}
                  onChange={(e) => patch(t.id, { month: clampNum(e.target.value, 1, 12) })}
                />
                <span className="muted">月</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={t.day}
                  aria-label="日"
                  style={dateInputStyle}
                  onChange={(e) => patch(t.id, { day: clampNum(e.target.value, 1, 31) })}
                />
                <span className="muted">日</span>
                <strong style={{ marginLeft: 6 }}>{t.destination || "（未入力）"}</strong>
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                {t.visitTo} {t.purpose && `／ ${t.purpose}`} ・ 小計{" "}
                {tripTotal(t).toLocaleString()} 円
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

/** 出力対象の期間ラベルを作る（例: 6/12〜6/20。単日なら 6/12） */
function periodLabelOf(trips: Trip[]): string {
  if (trips.length === 0) return "";
  const keys = trips.map((t) => t.month * 100 + t.day);
  const min = Math.min(...keys);
  const max = Math.max(...keys);
  const fmt = (k: number) => `${Math.floor(k / 100)}/${k % 100}`;
  return min === max ? fmt(min) : `${fmt(min)}〜${fmt(max)}`;
}

/** 出力履歴の生成時刻を「M/D HH:MM」で表示する */
function formatOutputAt(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  // 出力（Excel生成）の簡易履歴（期間・金額・件数）
  const [outputHistory, setOutputHistory] = useState<OutputHistoryEntry[]>([]);
  useEffect(() => {
    setOutputHistory(loadOutputHistory());
  }, []);

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

      // 出力履歴（期間・金額・件数）を残す
      setOutputHistory(
        recordOutput({
          periodLabel: periodLabelOf(selectedTrips),
          amount: selectedTotal,
          count: selectedTrips.length,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  const historyCard =
    outputHistory.length > 0 ? (
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <strong>出力の履歴</strong>
          <button
            className="btn ghost"
            style={{ padding: "6px 12px", minHeight: "auto" }}
            onClick={() => {
              if (window.confirm("出力履歴をすべて消しますか？")) {
                setOutputHistory(clearOutputHistory());
              }
            }}
          >
            履歴を消す
          </button>
        </div>
        <div className="output-history">
          {outputHistory.map((h, i) => (
            <div key={i} className="output-history-row">
              <span className="muted" style={{ fontSize: "0.8rem", minWidth: 76 }}>
                {formatOutputAt(h.at)}
              </span>
              <span style={{ flex: 1 }}>
                期間 <strong>{h.periodLabel || "―"}</strong> ／ {h.count} 件
              </span>
              <strong>{h.amount.toLocaleString()} 円</strong>
              <button
                className="btn danger output-history-del"
                title="この履歴を削除"
                aria-label="この履歴を削除"
                onClick={() => setOutputHistory(removeOutputAt(i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  if (selectedTrips.length === 0) {
    return (
      <div>
        <div className="card muted">
          出力する出張が選択されていません。「一覧」タブで出力したい出張にチェックを入れてください。
        </div>
        {historyCard}
      </div>
    );
  }

  return (
    <div>
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
          月ごとにシートを分けます。1シートは6件まで。7件目以降は同じ月の2枚目・3枚目のシートに自動で続きます。
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
      {historyCard}
    </div>
  );
}
