import { useApp } from '../store/AppContext';
import { deriveVoyageState } from '../domain/sequence';
import { validateEvent, summarize, isSendable } from '../domain/validation';
import { baselineWithout } from '../domain/fuelLedger';
import { eventTypeById } from '../data/eventTypes';
import { portLabel } from '../data/ports';
import { fmtUtc } from '../lib/util';
import { CheckChip, StatusChip, StateChip } from '../components/common/Status';
import { FuelInfoPanel } from '../components/common/FuelInfoPanel';
import type { PageKey } from './AppShell';

export function Dashboard({ onNavigate }: { onNavigate: (k: PageKey) => void }) {
  const { db } = useApp();
  if (!db) return null;

  const state = deriveVoyageState(db.events);
  const sorted = [...db.events].sort((a, b) => b.timeUtc.localeCompare(a.timeUtc));
  const latest = sorted.find((e) => e.status !== 'draft');
  const voyage = db.voyages.find((v) => v.id === latest?.voyageId) ?? db.voyages[db.voyages.length - 1];
  const voyageEvents = db.events.filter((e) => e.voyageId === voyage?.id && e.status !== 'draft');
  const unsent = db.events.filter((e) => e.status !== 'sent');
  const blocked = unsent.filter((e) => !isSendable(db, e));
  const totalRob = db.fuels.reduce((s, f) => s + f.rob, 0);

  const distance = voyageEvents.reduce((s, e) => s + (Number(e.distanceNm) || 0), 0);
  const steaming = voyageEvents.reduce((s, e) => s + (Number(e.steamingHours) || 0), 0);
  const avgSpeed = steaming > 0 ? distance / steaming : 0;
  const lastPos = sorted.find((e) => e.position?.lat !== undefined)?.position;

  const inChargeMaster = db.officers.find((o) => o.role === 'Master' && o.inCharge);
  const inChargeCE = db.officers.find((o) => o.role === 'Chief Engineer' && o.inCharge);
  const nextPort = db.schedule[0];

  return (
    <div className="stack">
      {/* KPI strip */}
      <div className="kpi-row">
        <div className="kpi kpi-accent">
          <div className="label">Voyage state</div>
          <div className="value sm" style={{ marginTop: 8 }}><StateChip state={state} /></div>
        </div>
        <div className="kpi">
          <div className="label">🗺️ Current voyage</div>
          <div className="value sm">{voyage ? voyage.voyageNo : '—'}</div>
          {voyage && <div className="sub">{portLabel(voyage.departurePort)} → {portLabel(voyage.arrivalPort)}</div>}
        </div>
        <div className="kpi">
          <div className="label">⛽ Total fuel ROB</div>
          <div className="value">{totalRob.toFixed(0)}<span className="unit">mt</span></div>
          <div className="sub">{db.fuels.length} grade(s) onboard</div>
        </div>
        <div className="kpi">
          <div className="label">📏 Distance (voyage)</div>
          <div className="value">{distance.toFixed(0)}<span className="unit">nm</span></div>
          <div className="sub">avg {avgSpeed.toFixed(1)} kn over {steaming.toFixed(0)} h</div>
        </div>
        <div className={`kpi ${blocked.length ? 'kpi-err' : unsent.length ? 'kpi-warn' : 'kpi-ok'}`}>
          <div className="label">📡 Outbox</div>
          <div className="value">{unsent.length}</div>
          <div className="sub">{blocked.length ? `${blocked.length} with errors` : unsent.length ? 'all error-free' : 'all sent'}</div>
        </div>
      </div>

      {/* Voyage progress */}
      {voyage && (
        <div className="card">
          <div className="card-head">
            <h3>Voyage {voyage.voyageNo} · {voyage.service}</h3>
            <span className="subtle">{voyage.type} · {voyage.stages.map((s) => s.kind).join(' / ') || '—'}</span>
          </div>
          <div className="voyage-track">
            <div className="pt done"><span className="nodedot" /><span className="lbl">{portLabel(voyage.departurePort)}</span></div>
            <div className="seg done" />
            <div className="pt current"><span className="nodedot" /><span className="lbl">{state}{lastPos ? ` · ${fmtPos(lastPos.lat!, lastPos.lon!)}` : ''}</span></div>
            <div className="seg" />
            <div className="pt"><span className="nodedot" /><span className="lbl">{portLabel(voyage.arrivalPort)}</span></div>
          </div>
        </div>
      )}

      <div className="layout-split">
        <div className="card flush">
          <div className="card-head">
            <h2>Recent events</h2>
            <button className="btn-primary btn-sm" onClick={() => onNavigate('events')}>Open Events →</button>
          </div>
          {sorted.length === 0 ? (
            <div className="empty"><span className="ico">📝</span>No events yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Time (UTC)</th><th>Event</th><th className="num">Dist.</th><th>Status</th><th>Value check</th></tr></thead>
                <tbody>
                  {sorted.slice(0, 7).map((e) => {
                    const base = e.status === 'sent' ? db : baselineWithout(db, e.id);
                    const sum = summarize(validateEvent(base, e));
                    return (
                      <tr key={e.id} className={e.status === 'draft' ? 'draft' : ''}>
                        <td className="nowrap">{fmtUtc(e.timeUtc)}</td>
                        <td>{eventTypeById(e.typeId)?.name ?? e.typeId}</td>
                        <td className="num">{e.distanceNm ? `${e.distanceNm}` : '—'}</td>
                        <td><StatusChip status={e.status} /></td>
                        <td><CheckChip summary={sum} sent={e.status === 'sent'} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>⛽ Information — ROB</h3></div>
            {db.fuels.length === 0 ? <div className="empty">No fuels onboard.</div> : <FuelInfoPanel fuels={db.fuels} />}
          </div>
          <div className="card">
            <h3>👮 In charge</h3>
            <table>
              <tbody>
                <tr><td>Master</td><td className="right">{inChargeMaster?.name ?? '—'}</td></tr>
                <tr><td>Chief Engineer</td><td className="right">{inChargeCE?.name ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>
          {nextPort && (
            <div className="card">
              <h3>📅 Next port call</h3>
              <p style={{ margin: 0 }}>
                <strong>{portLabel(nextPort.port)}</strong><br />
                <span className="subtle">ETA {nextPort.eta?.replace('T', ' ') || '—'}</span>
              </p>
              <button className="btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => onNavigate('schedule')}>View schedule →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtPos(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`;
}
