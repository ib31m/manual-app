import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { DISPOSAL_EVENT_IDS, eventTypeById } from '../data/eventTypes';
import { fuelGroup, robBySulphur } from '../domain/fuelInfo';
import { portLabel } from '../data/ports';
import { fmtUtc, fmtDate, toCsv, downloadText } from '../lib/util';
import type { OnboardDB, VesselEvent } from '../domain/types';

const METHOD_LABEL: Record<string, string> = {
  disposal_incineration: 'Incineration',
  disposal_ashore: 'Ashore',
  disposal_overboard: 'Over board',
  disposal_barge: 'By barge',
};

// IMO carbon factors (t CO2 / t fuel) by fuel group — for the voyage CO2 estimate.
const CARBON_FACTOR: Record<string, number> = {
  'LFO/HFO': 3.114,
  'MDO/MGO': 3.206,
  'Gas/Alcohol': 2.75,
  'Bio-diesel': 2.834,
  HVO: 3.115,
  'Other (Biofuel)': 2.8,
  Blend: 3.0,
  Other: 3.0,
};

export function ReportsPage() {
  const { db, notify } = useApp();
  const [tab, setTab] = useState<'summary' | 'garbage' | 'abstract'>('summary');
  const [voyageId, setVoyageId] = useState(db?.voyages[db.voyages.length - 1]?.id ?? '');
  if (!db) return null;

  return (
    <div className="stack">
      <div className="tabs">
        <div className={`tab${tab === 'summary' ? ' active' : ''}`} onClick={() => setTab('summary')}>Voyage Summary</div>
        <div className={`tab${tab === 'garbage' ? ' active' : ''}`} onClick={() => setTab('garbage')}>Garbage Record Book</div>
        <div className={`tab${tab === 'abstract' ? ' active' : ''}`} onClick={() => setTab('abstract')}>Log Abstract</div>
      </div>

      {tab === 'summary' && <VoyageSummary db={db} voyageId={voyageId} setVoyageId={setVoyageId} notify={notify} />}
      {tab === 'garbage' && <GarbageBook db={db} notify={notify} />}
      {tab === 'abstract' && <LogAbstract db={db} notify={notify} />}
    </div>
  );
}

// ---------- Voyage Summary ----------
function VoyageSummary({ db, voyageId, setVoyageId, notify }: { db: OnboardDB; voyageId: string; setVoyageId: (v: string) => void; notify: (k: 'ok' | 'err' | 'info', t: string) => void }) {
  const voyage = db.voyages.find((v) => v.id === voyageId) ?? db.voyages[0];
  if (!voyage) return <div className="card"><div className="empty">No voyages.</div></div>;
  const events = db.events.filter((e) => e.voyageId === voyage.id && e.status !== 'draft').sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));

  const distance = events.reduce((s, e) => s + (Number(e.distanceNm) || 0), 0);
  const steaming = events.reduce((s, e) => s + (Number(e.steamingHours) || 0), 0);
  const avgSpeed = steaming > 0 ? distance / steaming : 0;

  // Consumption by fuel + CO2.
  const byFuel = new Map<string, number>();
  events.forEach((e) => { if (!e.consumptionsSkipped) e.consumptions.forEach((c) => byFuel.set(c.fuelId, (byFuel.get(c.fuelId) ?? 0) + (Number(c.amount) || 0))); });
  let totalCons = 0, totalCo2 = 0;
  const fuelRows = [...byFuel.entries()].map(([fuelId, mt]) => {
    const fuel = db.fuels.find((f) => f.id === fuelId);
    const grp = fuel ? fuelGroup(fuel.gradeId) : 'Other';
    const co2 = mt * (CARBON_FACTOR[grp] ?? 3.0);
    totalCons += mt; totalCo2 += co2;
    return { label: fuel?.label ?? fuelId, group: grp, mt, co2 };
  }).sort((a, b) => b.mt - a.mt);

  const span = events.length >= 2 ? (Date.parse(events[events.length - 1].timeUtc) - Date.parse(events[0].timeUtc)) / 86400000 : 0;
  const rob = robBySulphur(db.fuels);
  const cargo = db.bills.filter((b) => b.status !== 'discharged').reduce((s, b) => s + b.quantity, 0);

  function exportSummary() {
    const rows: (string | number)[][] = [
      ['Voyage', voyage.voyageNo], ['Service', voyage.service], ['Type', voyage.type],
      ['From', portLabel(voyage.departurePort)], ['To', portLabel(voyage.arrivalPort)],
      ['Distance (nm)', distance.toFixed(0)], ['Steaming (h)', steaming.toFixed(1)], ['Avg speed (kn)', avgSpeed.toFixed(2)],
      ['Total consumption (mt)', totalCons.toFixed(2)], ['Estimated CO2 (mt)', totalCo2.toFixed(1)], [],
      ['Fuel', 'Group', 'Consumed (mt)', 'CO2 (mt)'],
      ...fuelRows.map((r) => [r.label, r.group, r.mt.toFixed(2), r.co2.toFixed(1)]),
    ];
    downloadText(`voyage_${voyage.voyageNo}_summary.csv`, toCsv(rows));
    notify('ok', 'Voyage summary exported (CSV).');
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div className="row" style={{ gap: 12 }}>
            <h2 style={{ margin: 0 }}>Voyage Summary</h2>
            <select value={voyageId} onChange={(e) => setVoyageId(e.target.value)} style={{ width: 'auto' }}>
              {db.voyages.map((v) => <option key={v.id} value={v.id}>{v.voyageNo} — {v.departurePort}→{v.arrivalPort}</option>)}
            </select>
          </div>
          <button onClick={exportSummary}>Export to Excel (CSV)</button>
        </div>

        <div className="kpi-row">
          <div className="kpi kpi-accent"><div className="label">Route</div><div className="value sm">{voyage.departurePort} → {voyage.arrivalPort}</div><div className="sub">{voyage.service} · {voyage.type}</div></div>
          <div className="kpi"><div className="label">Distance</div><div className="value">{distance.toFixed(0)}<span className="unit">nm</span></div><div className="sub">{span > 0 ? `over ${span.toFixed(1)} days` : ''}</div></div>
          <div className="kpi"><div className="label">Avg speed</div><div className="value">{avgSpeed.toFixed(1)}<span className="unit">kn</span></div><div className="sub">{steaming.toFixed(0)} steaming h</div></div>
          <div className="kpi"><div className="label">Fuel consumed</div><div className="value">{totalCons.toFixed(0)}<span className="unit">mt</span></div></div>
          <div className="kpi kpi-warn"><div className="label">Est. CO₂</div><div className="value">{totalCo2.toFixed(0)}<span className="unit">mt</span></div><div className="sub">IMO carbon factors</div></div>
        </div>
      </div>

      <div className="layout-split">
        <div className="card flush">
          <div className="card-head"><h3>Consumption by fuel</h3></div>
          {fuelRows.length === 0 ? <div className="empty">No consumption recorded on this voyage.</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fuel</th><th>Group</th><th className="num">Consumed</th><th className="num">CO₂ est.</th></tr></thead>
                <tbody>
                  {fuelRows.map((r) => (
                    <tr key={r.label}><td>{r.label}</td><td>{r.group}</td><td className="num">{r.mt.toFixed(1)} mt</td><td className="num">{r.co2.toFixed(1)} mt</td></tr>
                  ))}
                  <tr className="row-strong"><td>Total</td><td></td><td className="num">{totalCons.toFixed(1)} mt</td><td className="num">{totalCo2.toFixed(1)} mt</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h3>Cargo</h3>
            {db.bills.length === 0 ? <div className="empty">No cargo.</div> : (
              <table><tbody>
                {db.bills.map((b) => <tr key={b.id}><td>{b.cargoType}</td><td className="right">{b.quantity.toLocaleString()} mt</td></tr>)}
                <tr className="row-strong"><td>Onboard</td><td className="right">{cargo.toLocaleString()} mt</td></tr>
              </tbody></table>
            )}
          </div>
          <div className="card">
            <h3>Bunkers ROB at report</h3>
            <table><tbody>
              <tr><td>ULS</td><td className="right">{rob.ULS.toFixed(1)} mt</td></tr>
              <tr><td>VLS</td><td className="right">{rob.VLS.toFixed(1)} mt</td></tr>
              <tr><td>HS</td><td className="right">{rob.HS.toFixed(1)} mt</td></tr>
              <tr className="row-strong"><td>Total</td><td className="right">{rob.total.toFixed(1)} mt</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Garbage Record Book ----------
function GarbageBook({ db, notify }: { db: OnboardDB; notify: (k: 'ok' | 'err' | 'info', t: string) => void }) {
  const disposals = db.events.filter((e) => DISPOSAL_EVENT_IDS.includes(e.typeId)).sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));
  const partI = disposals.filter((e) => (e.fields['garbage_part'] ?? 'I') !== 'II');
  const partII = disposals.filter((e) => e.fields['garbage_part'] === 'II');
  const total = disposals.reduce((s, e) => s + Number(e.fields['garbage_amount'] || 0), 0);

  function exportGarbage() {
    const rows: (string | number)[][] = [['Part', 'Date (UTC)', 'Category', 'Amount (m³)', 'Method', 'Position', 'Voyage']];
    disposals.forEach((e) => rows.push([
      String(e.fields['garbage_part'] ?? 'I'), fmtUtc(e.timeUtc), String(e.fields['garbage_category'] ?? ''),
      Number(e.fields['garbage_amount'] ?? 0), METHOD_LABEL[e.typeId] ?? '',
      e.position ? `${e.position.lat ?? ''}, ${e.position.lon ?? ''}` : '',
      db.voyages.find((v) => v.id === e.voyageId)?.voyageNo ?? '',
    ]));
    downloadText('garbage_record_book.csv', toCsv(rows));
    notify('ok', 'Garbage Record Book exported (CSV).');
  }

  return (
    <div className="card flush">
      <div className="card-head">
        <div><h2>Garbage Record Book</h2><span className="subtle">MARPOL Annex V · {total.toFixed(1)} m³ disposed in {disposals.length} entries</span></div>
        <button onClick={exportGarbage} disabled={disposals.length === 0}>Export to Excel (CSV)</button>
      </div>
      <div style={{ padding: '0 20px 16px' }}>
        <div className="section-title">Part I — all garbage other than cargo residues</div>
        <GarbageTable rows={partI} db={db} />
        <div className="section-title">Part II — cargo residues (solid bulk cargo)</div>
        <GarbageTable rows={partII} db={db} />
      </div>
    </div>
  );
}

function GarbageTable({ rows, db }: { rows: VesselEvent[]; db: OnboardDB }) {
  if (rows.length === 0) return <div className="empty" style={{ padding: 20 }}>No entries.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Category</th><th className="num">Amount</th><th>Method</th><th>Position</th><th>Voyage</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="nowrap">{fmtDate(e.timeUtc)}</td>
              <td>{String(e.fields['garbage_category'] ?? '—')}</td>
              <td className="num">{e.fields['garbage_amount'] ? `${e.fields['garbage_amount']} m³` : '—'}</td>
              <td>{METHOD_LABEL[e.typeId]}</td>
              <td>{e.position?.lat !== undefined ? `${e.position.lat}, ${e.position.lon}` : '—'}</td>
              <td>{db.voyages.find((v) => v.id === e.voyageId)?.voyageNo ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Log Abstract ----------
function LogAbstract({ db, notify }: { db: OnboardDB; notify: (k: 'ok' | 'err' | 'info', t: string) => void }) {
  const events = [...db.events].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));

  function exportAbstract() {
    const rows: (string | number)[][] = [[
      'Time (UTC)', 'Zone', 'Event', 'Voyage', 'Lat', 'Lon', 'SOG', 'STW', 'Dist (nm)', 'Eng.dist', 'Slip %',
      'Steam (h)', 'RPM', 'Wind Bft', 'ME (h)', 'AE (h)', 'Cons (mt)', 'SFOC', 'Status',
    ]];
    events.forEach((e) => {
      const cons = e.consumptionsSkipped ? 0 : e.consumptions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const slip = e.engineDistanceNm && e.distanceNm ? (((e.engineDistanceNm - e.distanceNm) / e.engineDistanceNm) * 100).toFixed(1) : '';
      rows.push([
        fmtUtc(e.timeUtc), e.timeZoneLabel, eventTypeById(e.typeId)?.name ?? e.typeId,
        db.voyages.find((v) => v.id === e.voyageId)?.voyageNo ?? '',
        e.position?.lat ?? '', e.position?.lon ?? '', e.sogKn ?? '', e.stwKn ?? '',
        e.distanceNm ?? '', e.engineDistanceNm ?? '', slip, e.steamingHours ?? '', e.avgRpm ?? '',
        e.weather?.windForceBft ?? '', e.machinery?.meHours ?? '', e.machinery?.aeHours ?? '',
        cons.toFixed(2), e.performance?.meSfocGkwh ?? '', e.status,
      ]);
    });
    downloadText('log_abstract.csv', toCsv(rows));
    notify('ok', 'Log Abstract exported (CSV).');
  }

  return (
    <div className="card flush">
      <div className="card-head">
        <div><h2>Log Abstract</h2><span className="subtle">One row per event — position, speed, distance, running hours, SFOC, consumption.</span></div>
        <button onClick={exportAbstract} disabled={events.length === 0}>Export to Excel (CSV)</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Time (UTC)</th><th>Event</th><th className="num">Dist</th><th className="num">SOG</th><th className="num">ME h</th><th className="num">Cons</th><th>Status</th></tr></thead>
          <tbody>
            {events.length === 0 && <tr><td colSpan={7} className="empty">No events.</td></tr>}
            {events.map((e) => {
              const cons = e.consumptionsSkipped ? 0 : e.consumptions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
              return (
                <tr key={e.id}>
                  <td className="nowrap">{fmtUtc(e.timeUtc)}</td>
                  <td>{eventTypeById(e.typeId)?.name ?? e.typeId}</td>
                  <td className="num">{e.distanceNm ?? '—'}</td>
                  <td className="num">{e.sogKn ?? '—'}</td>
                  <td className="num">{e.machinery?.meHours ?? '—'}</td>
                  <td className="num">{cons > 0 ? cons.toFixed(1) : '—'}</td>
                  <td>{e.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
