import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { PortDelay, PortFact, PortLogEntry } from '../domain/types';
import { portLabel } from '../data/ports';
import { uid, fmtUtc, downloadText, toCsv } from '../lib/util';
import { Modal } from '../components/common/Modal';
import { TextField, TextArea } from '../components/common/Fields';

// §3.5 — Working with port logs. A port log opens on Arrival / End-shifting and
// holds port facts (NOR, surveys…), delays + reasons, and remarks.
export function PortLogsPage() {
  const { db, update, notify } = useApp();
  const [editing, setEditing] = useState<PortLogEntry | null>(null);
  if (!db) return null;

  const logs = [...db.portLogs].sort((a, b) => openTime(b) - openTime(a));
  function openTime(p: PortLogEntry): number {
    const e = db!.events.find((x) => x.id === p.eventId);
    return e ? Date.parse(e.timeUtc) : 0;
  }

  function save(p: PortLogEntry) {
    update((d) => { const i = d.portLogs.findIndex((x) => x.id === p.id); if (i >= 0) d.portLogs[i] = p; });
    notify('ok', 'Port log saved.');
    setEditing(null);
  }

  function exportLog(p: PortLogEntry) {
    const rows: (string | number)[][] = [['Type', 'Detail', 'From', 'To', 'Remarks']];
    p.facts.forEach((f) => rows.push(['Fact', f.label, fmtUtc(f.timeUtc), '', '']));
    p.delays.forEach((d) => rows.push(['Delay', d.reason, fmtUtc(d.fromUtc), fmtUtc(d.toUtc), d.remarks ?? '']));
    downloadText(`portlog_${p.port}.csv`, toCsv(rows));
  }

  return (
    <div className="stack">
      <div className="card flush">
        <div className="card-head">
          <div><h2>Port logs</h2><span className="subtle">Generated automatically on Arrival / End-shifting events.</span></div>
        </div>
        {logs.length === 0 ? (
          <div className="empty"><span className="ico">⚓</span>No port logs yet. File an Arrival or End-shifting event to open one.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Port</th><th>Opened (UTC)</th><th className="num">Facts</th><th className="num">Delays</th><th>Remarks</th><th></th></tr></thead>
              <tbody>
                {logs.map((p) => {
                  const e = db.events.find((x) => x.id === p.eventId);
                  const totalDelay = p.delays.reduce((s, d) => s + delayHours(d), 0);
                  return (
                    <tr key={p.id} className="clickable" onClick={() => setEditing(structuredClone(p))}>
                      <td><strong>{portLabel(p.port)}</strong></td>
                      <td className="nowrap">{e ? fmtUtc(e.timeUtc) : '—'}</td>
                      <td className="num">{p.facts.length}</td>
                      <td className="num">{p.delays.length}{totalDelay ? ` (${totalDelay.toFixed(1)} h)` : ''}</td>
                      <td className="subtle" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.remarks || '—'}</td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <button className="btn-ghost btn-sm" onClick={() => setEditing(structuredClone(p))}>Edit</button>
                        <button className="btn-ghost btn-sm" onClick={() => exportLog(p)}>Export</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <PortLogEditor log={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function delayHours(d: PortDelay): number {
  const f = Date.parse(d.fromUtc), t = Date.parse(d.toUtc);
  return Number.isNaN(f) || Number.isNaN(t) || t < f ? 0 : (t - f) / 3.6e6;
}

function PortLogEditor({ log, onCancel, onSave }: { log: PortLogEntry; onCancel: () => void; onSave: (p: PortLogEntry) => void }) {
  const [p, setP] = useState<PortLogEntry>(log);
  const setFact = (id: string, patch: Partial<PortFact>) => setP((c) => ({ ...c, facts: c.facts.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const setDelay = (id: string, patch: Partial<PortDelay>) => setP((c) => ({ ...c, delays: c.delays.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));

  return (
    <Modal
      title={`Port log — ${portLabel(p.port)}`}
      onClose={onCancel}
      wide
      footer={<><button onClick={onCancel}>Cancel</button><button className="btn-primary" onClick={() => onSave(p)}>Save port log</button></>}
    >
      <div className="section-title">Port facts <button className="btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setP((c) => ({ ...c, facts: [...c.facts, { id: uid('pf'), label: '', timeUtc: new Date().toISOString() }] }))}>+ Add fact</button></div>
      {p.facts.length === 0 && <div className="hint">e.g. Notice of Readiness tendered, cargo tank survey, loading commenced…</div>}
      {p.facts.map((f) => (
        <div className="grid grid-2" key={f.id} style={{ alignItems: 'end' }}>
          <TextField label="Fact" value={f.label} onChange={(v) => setFact(f.id, { label: v })} placeholder="Notice of Readiness tendered" />
          <div className="row" style={{ alignItems: 'end', gap: 6 }}>
            <TextField label="Time (UTC)" type="datetime-local" value={f.timeUtc.slice(0, 16)} onChange={(v) => setFact(f.id, { timeUtc: v ? new Date(v).toISOString() : f.timeUtc })} />
            <button className="btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => setP((c) => ({ ...c, facts: c.facts.filter((x) => x.id !== f.id) }))}>🗑</button>
          </div>
        </div>
      ))}

      <div className="section-title">Delays <button className="btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setP((c) => ({ ...c, delays: [...c.delays, { id: uid('pd'), reason: '', fromUtc: new Date().toISOString(), toUtc: new Date().toISOString() }] }))}>+ Add delay</button></div>
      {p.delays.map((d) => (
        <div className="form-section" key={d.id}>
          <div className="grid grid-3" style={{ alignItems: 'end' }}>
            <TextField label="Reason" value={d.reason} onChange={(v) => setDelay(d.id, { reason: v })} placeholder="Awaiting berth / weather / customs" />
            <TextField label="From (UTC)" type="datetime-local" value={d.fromUtc.slice(0, 16)} onChange={(v) => setDelay(d.id, { fromUtc: v ? new Date(v).toISOString() : d.fromUtc })} />
            <TextField label="To (UTC)" type="datetime-local" value={d.toUtc.slice(0, 16)} onChange={(v) => setDelay(d.id, { toUtc: v ? new Date(v).toISOString() : d.toUtc })} />
          </div>
          <div className="row spread">
            <span className="subtle">Duration: {delayHours(d).toFixed(1)} h</span>
            <button className="btn-ghost btn-sm text-err" onClick={() => setP((c) => ({ ...c, delays: c.delays.filter((x) => x.id !== d.id) }))}>Remove delay</button>
          </div>
        </div>
      ))}

      <div className="divider" />
      <TextArea label="Remarks" value={p.remarks} onChange={(v) => setP((c) => ({ ...c, remarks: v }))} />
    </Modal>
  );
}
