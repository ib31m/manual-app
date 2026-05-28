import { useApp } from '../store/AppContext';
import type { ScheduleEntry } from '../domain/types';
import { PORTS, portLabel } from '../data/ports';
import { uid, toCsv, downloadText } from '../lib/util';

const portOpts = PORTS.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` }));

// §3.16 — Schedule: coastal/long-term schedule, port + ETA per call.
// All fields editable inline. Exportable. Standalone (not linked to voyages).
export function SchedulePage() {
  const { db, update, notify } = useApp();
  if (!db) return null;

  function addRow() {
    update((d) => d.schedule.push({ id: uid('sch'), port: '', eta: '', etd: '' }));
  }
  function setRow(id: string, patch: Partial<ScheduleEntry>) {
    update((d) => {
      const r = d.schedule.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    });
  }
  function remove(id: string) {
    update((d) => { d.schedule = d.schedule.filter((x) => x.id !== id); });
  }

  function exportCsv() {
    const rows: (string | number)[][] = [['Port', 'Port name', 'ETA', 'ETD', 'Agent']];
    db!.schedule.forEach((s) => {
      const agent = db!.agents.find((a) => a.id === s.agentId);
      rows.push([s.port, portLabel(s.port), s.eta, s.etd, agent?.company ?? '']);
    });
    downloadText('schedule.csv', toCsv(rows));
    notify('ok', 'Schedule exported (CSV).');
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Schedule</h2>
        <div className="btn-row">
          <button onClick={exportCsv}>Export CSV</button>
          <button className="btn-primary" onClick={addRow}>+ Add port call</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Port</th><th>ETA</th><th>ETD</th><th>Agent</th><th></th></tr>
          </thead>
          <tbody>
            {db.schedule.length === 0 && <tr><td colSpan={5} className="empty">No schedule entries. Add a port call.</td></tr>}
            {db.schedule.map((s) => (
              <tr key={s.id}>
                <td>
                  <select value={s.port} onChange={(e) => setRow(s.id, { port: e.target.value })}>
                    <option value="">Select…</option>
                    {portOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td><input type="datetime-local" value={s.eta} onChange={(e) => setRow(s.id, { eta: e.target.value })} /></td>
                <td><input type="datetime-local" value={s.etd} onChange={(e) => setRow(s.id, { etd: e.target.value })} /></td>
                <td>
                  <select value={s.agentId ?? ''} onChange={(e) => setRow(s.id, { agentId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {db.agents.filter((a) => a.servicedPorts.includes(s.port)).map((a) => <option key={a.id} value={a.id}>{a.company}</option>)}
                  </select>
                </td>
                <td><button className="btn-ghost btn-sm text-err" onClick={() => remove(s.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>
        The schedule is visible onshore and exportable. Agents can be assigned only in their serviced ports.
      </div>
    </div>
  );
}
