import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { BillOfLading } from '../domain/types';
import { PORTS, portLabel } from '../data/ports';
import { uid, num } from '../lib/util';
import { Modal } from '../components/common/Modal';
import { NumberField, SelectField, TextField } from '../components/common/Fields';

const portOpts = PORTS.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` }));

const STATUS_BADGE: Record<BillOfLading['status'], string> = {
  loading: 'badge-warn',
  onboard: 'badge-amber',
  discharged: 'badge-ok',
};

// §3.4 — Cargo: Bills of Lading + cargo details (density per cargo).
// Visible only for tankers / bulk / LNG / gas carriers (gated in AppShell).
export function CargoPage() {
  const { db, update, notify } = useApp();
  const [editing, setEditing] = useState<BillOfLading | null>(null);
  if (!db) return null;

  const totalOnboard = db.bills.filter((b) => b.status !== 'discharged').reduce((s, b) => s + b.quantity, 0);

  function blank(): BillOfLading {
    return { id: uid('bl'), blNumber: '', cargoType: '', density: 1, quantity: 0, loadPort: '', dischargePort: '', status: 'onboard' };
  }

  function save(b: BillOfLading) {
    if (!b.blNumber.trim() || !b.cargoType.trim()) {
      notify('err', 'B/L number and cargo type are required.');
      return;
    }
    if (b.density <= 0) {
      notify('err', 'Density must be greater than zero.');
      return;
    }
    update((d) => {
      const i = d.bills.findIndex((x) => x.id === b.id);
      if (i >= 0) d.bills[i] = b; else d.bills.push(b);
    });
    notify('ok', 'Bill of Lading saved.');
    setEditing(null);
  }

  return (
    <div className="stack">
      <div className="kpi-row">
        <div className="kpi"><div className="label">Bills of Lading</div><div className="value">{db.bills.length}</div></div>
        <div className="kpi"><div className="label">Total mass onboard</div><div className="value">{totalOnboard.toLocaleString()}<span style={{ fontSize: '.9rem' }}> mt</span></div></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Cargo — Bills of Lading</h2>
          <button className="btn-primary" onClick={() => setEditing(blank())}>+ New B/L</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>B/L</th><th>Cargo</th><th>Density</th><th>Quantity</th><th>Load → Discharge</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {db.bills.length === 0 && <tr><td colSpan={7} className="empty">No cargo recorded. Click “New B/L”.</td></tr>}
              {db.bills.map((b) => (
                <tr key={b.id} className="clickable" onClick={() => setEditing(structuredClone(b))}>
                  <td><strong>{b.blNumber}</strong></td>
                  <td>{b.cargoType}{b.specificType ? ` (${b.specificType})` : ''}</td>
                  <td>{b.density} t/m³</td>
                  <td>{b.quantity.toLocaleString()} mt</td>
                  <td>{portLabel(b.loadPort)} → {portLabel(b.dischargePort)}</td>
                  <td><span className={`badge ${STATUS_BADGE[b.status]}`}>{b.status}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn-ghost btn-sm text-err" onClick={() => { update((d) => { d.bills = d.bills.filter((x) => x.id !== b.id); }); notify('info', 'B/L removed.'); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Enter a density for each cargo. Loading/unloading operations and total mass onboard are
          confirmed in the Departure event (calculator).
        </div>
      </div>

      {editing && <BlEditor bl={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function BlEditor({ bl, onCancel, onSave }: { bl: BillOfLading; onCancel: () => void; onSave: (b: BillOfLading) => void }) {
  const [b, setB] = useState(bl);
  const set = <K extends keyof BillOfLading>(k: K, v: BillOfLading[K]) => setB((c) => ({ ...c, [k]: v }));
  return (
    <Modal title={bl.blNumber ? `Edit ${bl.blNumber}` : 'New Bill of Lading'} onClose={onCancel} footer={<><button onClick={onCancel}>Cancel</button><button className="btn-primary" onClick={() => onSave(b)}>Save</button></>}>
      <div className="grid grid-2">
        <TextField label="B/L number" required value={b.blNumber} onChange={(v) => set('blNumber', v)} />
        <TextField label="Cargo type" required value={b.cargoType} onChange={(v) => set('cargoType', v)} placeholder="Iron ore, Crude oil…" />
        <TextField label="Specific type (optional)" value={b.specificType ?? ''} onChange={(v) => set('specificType', v)} />
        <NumberField label="Density" unit="t/m³" required value={b.density} onChange={(v) => set('density', num(v) ?? 0)} />
        <NumberField label="Quantity" unit="mt" value={b.quantity} onChange={(v) => set('quantity', num(v) ?? 0)} />
        <SelectField label="Status" value={b.status} onChange={(v) => set('status', v as BillOfLading['status'])} options={[{ value: 'loading', label: 'Loading' }, { value: 'onboard', label: 'Onboard' }, { value: 'discharged', label: 'Discharged' }]} />
        <SelectField label="Load port" value={b.loadPort} onChange={(v) => set('loadPort', v)} options={portOpts} />
        <SelectField label="Discharge port" value={b.dischargePort} onChange={(v) => set('dischargePort', v)} options={portOpts} />
      </div>
    </Modal>
  );
}
