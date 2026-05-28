import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { SpeedOrder, Voyage, VoyageStage, VoyageType } from '../domain/types';
import { PORTS, portLabel } from '../data/ports';
import { uid, fmtDate, num } from '../lib/util';
import { Modal, Confirm } from '../components/common/Modal';
import { NumberField, SelectField, TextField } from '../components/common/Fields';

const portOpts = PORTS.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` }));

export function VoyagesPage() {
  const { db, update, notify } = useApp();
  const [editing, setEditing] = useState<Voyage | null>(null);
  const [confirmDel, setConfirmDel] = useState<Voyage | null>(null);
  if (!db) return null;

  // Only the latest, unsent voyage may be deleted; never the only one (§3.15.4).
  const latest = db.voyages[db.voyages.length - 1];
  function canDelete(v: Voyage) {
    return db!.voyages.length > 1 && v.id === latest?.id && !v.sent;
  }

  function blankVoyage(): Voyage {
    return {
      id: uid('voy'),
      voyageNo: '',
      service: '',
      type: 'One way',
      departurePort: '',
      arrivalPort: '',
      stages: [],
      speedOrders: [],
      sent: false,
    };
  }

  function onSave(v: Voyage) {
    if (!v.voyageNo.trim()) {
      notify('err', 'Voyage number is required.');
      return;
    }
    update((d) => {
      const i = d.voyages.findIndex((x) => x.id === v.id);
      if (i >= 0) d.voyages[i] = v;
      else d.voyages.push(v);
    });
    notify('ok', 'Voyage saved.');
    setEditing(null);
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Voyages</h2>
          <button className="btn-primary" onClick={() => setEditing(blankVoyage())}>+ New voyage</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Voyage no.</th><th>Type</th><th>Route</th><th>Service</th><th>Stages</th><th>Sent</th><th></th></tr>
            </thead>
            <tbody>
              {db.voyages.map((v) => (
                <tr key={v.id} className="clickable" onClick={() => setEditing(structuredClone(v))}>
                  <td><strong>{v.voyageNo}</strong></td>
                  <td>{v.type}</td>
                  <td>{portLabel(v.departurePort)} → {v.type === 'Round' ? `${portLabel(v.turnPort || '')} →` : ''} {portLabel(v.arrivalPort)}</td>
                  <td>{v.service || '—'}</td>
                  <td>{v.stages.length}</td>
                  <td>{v.sent ? <span className="badge badge-ok">Sent</span> : <span className="badge badge-muted">No</span>}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(structuredClone(v))}>Edit</button>
                    {canDelete(v) && <button className="btn-ghost btn-sm text-err" onClick={() => setConfirmDel(v)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Every event must belong to a voyage. Only the latest, unsent voyage can be deleted.
        </div>
      </div>

      {editing && <VoyageEditor voyage={editing} onCancel={() => setEditing(null)} onSave={onSave} />}

      {confirmDel && (
        <Confirm
          title="Delete voyage"
          danger
          confirmLabel="Delete voyage"
          message={<p>Delete voyage {confirmDel.voyageNo}? Only possible because it is the latest and not yet sent.</p>}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            update((d) => { d.voyages = d.voyages.filter((x) => x.id !== confirmDel.id); });
            notify('info', 'Voyage deleted.');
            setConfirmDel(null);
          }}
        />
      )}
    </div>
  );
}

function VoyageEditor({ voyage, onCancel, onSave }: { voyage: Voyage; onCancel: () => void; onSave: (v: Voyage) => void }) {
  const [v, setV] = useState<Voyage>(voyage);
  const set = <K extends keyof Voyage>(k: K, val: Voyage[K]) => setV((cur) => ({ ...cur, [k]: val }));

  function addStage() {
    const stage: VoyageStage = { id: uid('stg'), kind: 'LADEN', fromPort: v.departurePort, toPort: v.arrivalPort };
    setV((cur) => ({ ...cur, stages: [...cur.stages, stage] }));
  }
  function setStage(id: string, patch: Partial<VoyageStage>) {
    setV((cur) => ({ ...cur, stages: cur.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }
  function addSpeedOrder() {
    const so: SpeedOrder = { id: uid('so'), name: '', minSpeedKn: 0, maxConsumptionMtPerDay: 0, fuelType: 'HFO', weatherLimit: '' };
    setV((cur) => ({ ...cur, speedOrders: [...cur.speedOrders, so] }));
  }
  function setSO(id: string, patch: Partial<SpeedOrder>) {
    setV((cur) => ({ ...cur, speedOrders: cur.speedOrders.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }

  const isRound = v.type === 'Round';
  const isIdle = v.type === 'Idle';

  return (
    <Modal
      title={voyage.voyageNo ? `Edit voyage ${voyage.voyageNo}` : 'New voyage'}
      onClose={onCancel}
      wide
      footer={
        <>
          <button onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(v)}>Save voyage</button>
        </>
      }
    >
      <div className="grid grid-2">
        <TextField label="Voyage no." required value={v.voyageNo} onChange={(x) => set('voyageNo', x)} hint="Format per your operator's instructions." />
        <TextField label="Service / Trade" value={v.service} onChange={(x) => set('service', x)} />
        <SelectField label="Voyage type" value={v.type} onChange={(x) => set('type', x as VoyageType)} options={[{ value: 'One way', label: 'One way' }, { value: 'Round', label: 'Round voyage' }, { value: 'Idle', label: 'Idle' }]} />
        <SelectField label={isIdle ? 'Idling port' : 'Departure port'} value={v.departurePort} onChange={(x) => set('departurePort', x)} options={portOpts} />
        {!isIdle && (
          <SelectField label={isRound ? 'Arrival port (= departure)' : 'Arrival port'} value={isRound ? v.departurePort : v.arrivalPort} onChange={(x) => !isRound && set('arrivalPort', x)} options={portOpts} />
        )}
        {isRound && (
          <SelectField label="Turn port" value={v.turnPort ?? ''} onChange={(x) => set('turnPort', x)} options={portOpts} />
        )}
        <TextField label={isIdle ? 'Start' : 'Departure time'} type="datetime-local" value={v.departureTime?.slice(0, 16) ?? ''} onChange={(x) => set('departureTime', x ? new Date(x).toISOString() : undefined)} />
        <TextField label={isIdle ? 'Expected end' : 'Arrival time (ETA)'} type="datetime-local" value={v.arrivalTime?.slice(0, 16) ?? ''} onChange={(x) => set('arrivalTime', x ? new Date(x).toISOString() : undefined)} />
      </div>

      {!isIdle && (
        <>
          <div className="section-title">Voyage stages <button className="btn-sm" style={{ marginLeft: 'auto' }} onClick={addStage}>+ Add stage</button></div>
          {v.stages.length === 0 && <div className="hint">No stages. Add BALLAST/LADEN or directional (E/W/S/N) stages.</div>}
          {v.stages.map((s) => (
            <div className="grid grid-3" key={s.id} style={{ alignItems: 'end' }}>
              <SelectField label="Stage kind" value={s.kind} onChange={(x) => setStage(s.id, { kind: x as VoyageStage['kind'] })} options={['BALLAST', 'LADEN', 'E', 'W', 'S', 'N'].map((k) => ({ value: k, label: k }))} />
              <SelectField label="From" value={s.fromPort} onChange={(x) => setStage(s.id, { fromPort: x })} options={portOpts} />
              <div className="row" style={{ alignItems: 'end', gap: 6 }}>
                <SelectField label="To" value={s.toPort} onChange={(x) => setStage(s.id, { toPort: x })} options={portOpts} />
                <button className="btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => setV((cur) => ({ ...cur, stages: cur.stages.filter((x) => x.id !== s.id) }))}>🗑</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-title">Speed orders <button className="btn-sm" style={{ marginLeft: 'auto' }} onClick={addSpeedOrder}>+ Add speed order</button></div>
      {v.speedOrders.length === 0 && <div className="hint">Optional. Typically used for bulkers and tankers.</div>}
      {v.speedOrders.map((s) => (
        <div className="grid grid-3" key={s.id} style={{ alignItems: 'end' }}>
          <TextField label="Name" value={s.name} onChange={(x) => setSO(s.id, { name: x })} placeholder="Eco speed" />
          <NumberField label="Min speed" unit="kn" value={s.minSpeedKn} onChange={(x) => setSO(s.id, { minSpeedKn: num(x) ?? 0 })} />
          <NumberField label="Max consumption" unit="mt/day" value={s.maxConsumptionMtPerDay} onChange={(x) => setSO(s.id, { maxConsumptionMtPerDay: num(x) ?? 0 })} />
          <TextField label="Fuel type" value={s.fuelType} onChange={(x) => setSO(s.id, { fuelType: x })} />
          <div className="row" style={{ alignItems: 'end', gap: 6 }}>
            <TextField label="Weather limit" value={s.weatherLimit} onChange={(x) => setSO(s.id, { weatherLimit: x })} placeholder="BF ≤ 4" />
            <button className="btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => setV((cur) => ({ ...cur, speedOrders: cur.speedOrders.filter((x) => x.id !== s.id) }))}>🗑</button>
          </div>
        </div>
      ))}

      {voyage.departureTime && (
        <div className="hint" style={{ marginTop: 10 }}>Departure recorded {fmtDate(voyage.departureTime)}.</div>
      )}
    </Modal>
  );
}
