import { useApp } from '../store/AppContext';
import { deriveVoyageState } from '../domain/sequence';
import { isSendable } from '../domain/validation';
import { eventTypeById } from '../data/eventTypes';
import { portLabel } from '../data/ports';
import { fmtUtc } from '../lib/util';
import type { PageKey } from './AppShell';

export function Dashboard({ onNavigate }: { onNavigate: (k: PageKey) => void }) {
  const { db } = useApp();
  if (!db) return null;

  const state = deriveVoyageState(db.events);
  const sorted = [...db.events].sort((a, b) => b.timeUtc.localeCompare(a.timeUtc));
  const latest = sorted.find((e) => e.status !== 'draft');
  const currentVoyage =
    db.voyages.find((v) => v.id === latest?.voyageId) ?? db.voyages[db.voyages.length - 1];
  const unsent = db.events.filter((e) => e.status !== 'sent');
  const blocked = unsent.filter((e) => !isSendable(db, e));
  const totalRob = db.fuels.reduce((s, f) => s + f.rob, 0);
  const inChargeMaster = db.officers.find((o) => o.role === 'Master' && o.inCharge);

  return (
    <div className="stack">
      <div className="kpi-row">
        <div className="kpi">
          <div className="label">Voyage state</div>
          <div className="value sm">{state}</div>
        </div>
        <div className="kpi">
          <div className="label">Current voyage</div>
          <div className="value sm">{currentVoyage ? currentVoyage.voyageNo : '—'}</div>
          {currentVoyage && (
            <small>
              {portLabel(currentVoyage.departurePort)} → {portLabel(currentVoyage.arrivalPort)}
            </small>
          )}
        </div>
        <div className="kpi">
          <div className="label">Total fuel ROB</div>
          <div className="value">{totalRob.toFixed(1)}<span style={{ fontSize: '.9rem' }}> mt</span></div>
        </div>
        <div className="kpi">
          <div className="label">Unsent events</div>
          <div className="value">{unsent.length}</div>
          {blocked.length > 0 && <small className="text-err">{blocked.length} with errors</small>}
        </div>
      </div>

      <div className="layout-split">
        <div className="card">
          <div className="card-head">
            <h2>Recent events</h2>
            <button className="btn-primary btn-sm" onClick={() => onNavigate('events')}>
              Go to Events →
            </button>
          </div>
          {sorted.length === 0 ? (
            <div className="empty">No events yet. Create your first event from the Events page.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Time (UTC)</th><th>Event</th><th>Status</th><th>Check</th></tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 6).map((e) => {
                    const ok = isSendable(db, e);
                    return (
                      <tr key={e.id}>
                        <td className="nowrap">{fmtUtc(e.timeUtc)}</td>
                        <td>{eventTypeById(e.typeId)?.name ?? e.typeId}</td>
                        <td>
                          {e.status === 'draft' && <span className="badge badge-amber">Draft</span>}
                          {e.status === 'ready' && <span className="badge badge-muted">Ready</span>}
                          {e.status === 'sent' && <span className="badge badge-ok">Sent</span>}
                        </td>
                        <td>
                          {e.status === 'sent' ? (
                            <span className="dot dot-ok" />
                          ) : ok ? (
                            <span className="badge badge-ok">OK</span>
                          ) : (
                            <span className="badge badge-err">Errors</span>
                          )}
                        </td>
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
            <h3>Fuels onboard</h3>
            {db.fuels.length === 0 ? (
              <div className="empty">No fuels recorded.</div>
            ) : (
              <table>
                <tbody>
                  {db.fuels.map((f) => (
                    <tr key={f.id}>
                      <td>{f.label}</td>
                      <td className="nowrap" style={{ textAlign: 'right' }}>{f.rob.toFixed(1)} mt</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <h3>In charge</h3>
            <p style={{ margin: 0 }}>
              <strong>Master:</strong> {inChargeMaster?.name ?? '—'}
              <br />
              <strong>C/E:</strong>{' '}
              {db.officers.find((o) => o.role === 'Chief Engineer' && o.inCharge)?.name ?? '—'}
            </p>
          </div>
          {unsent.length > 0 && (
            <div className="card">
              <h3>Ready to send?</h3>
              <p className="text-muted" style={{ fontSize: '.85rem' }}>
                {blocked.length === 0
                  ? 'All unsent events are error-free.'
                  : `${blocked.length} event(s) still have errors and cannot be sent.`}
              </p>
              <button className="btn-accent btn-block" onClick={() => onNavigate('outbox')}>
                Open Communication
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
