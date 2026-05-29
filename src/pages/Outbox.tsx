import { Fragment, useState } from 'react';
import { useApp } from '../store/AppContext';
import { eventTypeById } from '../data/eventTypes';
import { validateEvent, summarize, isSendable } from '../domain/validation';
import { baselineWithout } from '../domain/fuelLedger';
import { sendReport } from '../server/mockServer';
import { fmtUtc } from '../lib/util';
import { saveBackup } from '../store/persistence';
import { CheckChip, StatusChip, SEVERITY_ICON } from '../components/common/Status';

// §3.19 Sending data + §4.3 Re-sending. The Outbox lists unsent events and
// only enables "Send all" when every event is error-free.
export function OutboxPage() {
  const { db, update, notify } = useApp();
  const [tab, setTab] = useState<'outbox' | 'archive'>('outbox');
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!db) return null;

  const unsent = [...db.events].filter((e) => e.status !== 'sent').sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));
  const checks = unsent.map((e) => ({ e, sum: summarize(validateEvent(baselineWithout(db, e.id), e)) }));
  const drafts = unsent.filter((e) => e.status === 'draft');
  const withErrors = checks.filter((c) => c.sum.errors > 0);
  const blocked = checks.filter((c) => c.sum.errors > 0 || c.e.status === 'draft');
  const ready = unsent.filter((e) => e.status === 'ready' && isSendable(db, e));
  const canSend = ready.length > 0 && withErrors.length === 0 && db.settings.exportConfigured;

  function sendAll() {
    if (!canSend) return;
    const { reportId, receivedAt } = sendReport(ready.length);
    update((d) => {
      const ids: string[] = [];
      d.events.forEach((e) => {
        if (e.status === 'ready' && isSendable(d, e)) {
          e.status = 'sent';
          e.sentAt = receivedAt;
          e.reportId = reportId;
          ids.push(e.id);
        }
      });
      const sentVoyages = new Set(d.events.filter((e) => e.status === 'sent').map((e) => e.voyageId));
      d.voyages.forEach((v) => { if (sentVoyages.has(v.id)) v.sent = true; });
      d.archive.unshift({ id: reportId, sentAt: receivedAt, eventIds: ids, summary: `${ids.length} event(s) sent` });
      if (d.settings.autoBackup) { saveBackup(d); d.lastBackup = receivedAt; }
    });
    notify('ok', `Report ${reportId} sent to shore (${ready.length} event(s)).`);
  }

  return (
    <div className="stack">
      <div className="tabs">
        <div className={`tab${tab === 'outbox' ? ' active' : ''}`} onClick={() => setTab('outbox')}>Outbox ({unsent.length})</div>
        <div className={`tab${tab === 'archive' ? ' active' : ''}`} onClick={() => setTab('archive')}>Archive ({db.archive.length})</div>
      </div>

      {tab === 'outbox' && (
        <>
          <div className="kpi-row">
            <div className="kpi"><div className="label">Ready to send</div><div className="value">{ready.length}</div></div>
            <div className={`kpi ${withErrors.length ? 'kpi-err' : 'kpi-ok'}`}><div className="label">With errors</div><div className="value">{withErrors.length}</div></div>
            <div className="kpi kpi-warn"><div className="label">Drafts (held)</div><div className="value">{drafts.length}</div></div>
          </div>

          <div className="card flush">
            <div className="card-head">
              <div><h2>Outbox</h2><span className="subtle">Drafts and red-error events are never sent; blue warnings may be sent.</span></div>
              <button className="btn-accent" disabled={!canSend} onClick={sendAll}>📡 Send all ({ready.length})</button>
            </div>

            {!db.settings.exportConfigured && (
              <div className="banner err" style={{ margin: '0 20px 16px' }}><span>⚠️</span> Data export is not configured. Configure it in Settings before sending.</div>
            )}
            {ready.length > 0 && withErrors.length === 0 && db.settings.exportConfigured && (
              <div className="banner ok" style={{ margin: '0 20px 16px' }}><span>✓</span> All ready events are error-free — you can send.</div>
            )}
            {blocked.length > 0 && (
              <div className="banner" style={{ margin: '0 20px 16px' }}>
                <span>⛔</span> {withErrors.length} event(s) with errors{drafts.length ? `, ${drafts.length} draft(s)` : ''} will not be sent.
              </div>
            )}

            {unsent.length === 0 ? (
              <div className="empty"><span className="ico">📡</span>Nothing to send — all events transmitted.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Time (UTC)</th><th>Event</th><th>Status</th><th>Value check</th><th></th></tr></thead>
                  <tbody>
                    {checks.map(({ e, sum }) => (
                      <Fragment key={e.id}>
                        <tr className={e.status === 'draft' ? 'draft clickable' : 'clickable'} onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                          <td className="nowrap">{fmtUtc(e.timeUtc)}</td>
                          <td>{eventTypeById(e.typeId)?.name ?? e.typeId}</td>
                          <td><StatusChip status={e.status} /></td>
                          <td><CheckChip summary={sum} /></td>
                          <td>{sum.results.length > 0 && <span className="btn-ghost btn-sm">{expanded === e.id ? '▲' : '▼'}</span>}</td>
                        </tr>
                        {expanded === e.id && sum.results.length > 0 && (
                          <tr>
                            <td colSpan={5} style={{ background: 'var(--bg-2)' }}>
                              {sum.results.map((r, i) => (
                                <div key={i} className={`check-item ${r.severity}`} style={{ marginBottom: 6 }}>
                                  <span className="sev-ico">{SEVERITY_ICON[r.severity]}</span>
                                  <div><span className="field-name">{r.field}</span> {r.message}</div>
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'archive' && (
        <div className="card flush">
          <div className="card-head"><h2>Archive</h2></div>
          {db.archive.length === 0 ? (
            <div className="empty"><span className="ico">🗄️</span>No reports sent yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Report ID</th><th>Sent at (UTC)</th><th>Summary</th><th></th></tr></thead>
                <tbody>
                  {db.archive.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.id}</td>
                      <td className="nowrap">{fmtUtc(r.sentAt)}</td>
                      <td>{r.summary}</td>
                      <td><button className="btn-ghost btn-sm" onClick={() => notify('info', `Report ${r.id} re-sent to shore.`)}>Resend</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
