import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { eventTypeById } from '../data/eventTypes';
import { validateEvent, summarize, isSendable } from '../domain/validation';
import { baselineWithout } from '../domain/fuelLedger';
import { sendReport } from '../server/mockServer';
import { fmtUtc } from '../lib/util';
import { saveBackup } from '../store/persistence';

// §3.19 Sending data + §4.3 Re-sending. The Outbox lists unsent events and
// only enables "Send all" when every event is error-free.
export function OutboxPage() {
  const { db, update, notify } = useApp();
  const [tab, setTab] = useState<'outbox' | 'archive'>('outbox');
  if (!db) return null;

  const unsent = [...db.events].filter((e) => e.status !== 'sent').sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));
  const checks = unsent.map((e) => ({ e, sum: summarize(validateEvent(baselineWithout(db, e.id), e)) }));
  const drafts = unsent.filter((e) => e.status === 'draft');
  const blocked = checks.filter((c) => c.sum.errors > 0 || c.e.status === 'draft');
  const canSend = unsent.length > 0 && blocked.length === 0 && db.settings.exportConfigured;

  function sendAll() {
    if (!canSend) return;
    const sendable = unsent.filter((e) => e.status === 'ready' && isSendable(db!, e));
    const { reportId, receivedAt } = sendReport(sendable.length);
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
      // Voyages referenced by sent events are now considered sent.
      const sentVoyages = new Set(d.events.filter((e) => e.status === 'sent').map((e) => e.voyageId));
      d.voyages.forEach((v) => { if (sentVoyages.has(v.id)) v.sent = true; });
      d.archive.unshift({ id: reportId, sentAt: receivedAt, eventIds: ids, summary: `${ids.length} event(s) sent` });
      // Automatic backup after a successful send (§4.7).
      if (d.settings.autoBackup) {
        saveBackup(d);
        d.lastBackup = receivedAt;
      }
    });
    notify('ok', `Report ${reportId} sent to shore (${sendable.length} event(s)).`);
  }

  function resend(reportId: string) {
    notify('info', `Report ${reportId} re-sent to shore.`);
  }

  return (
    <div className="stack">
      <div className="pill-group">
        <span className={`pill${tab === 'outbox' ? ' active' : ''}`} onClick={() => setTab('outbox')}>Outbox ({unsent.length})</span>
        <span className={`pill${tab === 'archive' ? ' active' : ''}`} onClick={() => setTab('archive')}>Archive ({db.archive.length})</span>
      </div>

      {tab === 'outbox' && (
        <div className="card">
          <div className="card-head">
            <h2>Outbox</h2>
            <button className="btn-accent" disabled={!canSend} onClick={sendAll}>📡 Send all</button>
          </div>

          {!db.settings.exportConfigured && (
            <div className="banner"><span>⚠️</span> Data export is not configured. Go to Settings to configure it before sending.</div>
          )}
          {unsent.length > 0 && blocked.length > 0 && (
            <div className="banner">
              <span>⛔</span>
              Sending is disabled until all issues are resolved: {checks.filter((c) => c.sum.errors > 0).length} event(s) with errors
              {drafts.length > 0 ? `, ${drafts.length} draft(s)` : ''}.
            </div>
          )}

          {unsent.length === 0 ? (
            <div className="empty">Nothing to send — all events have been transmitted.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Time (UTC)</th><th>Event</th><th>Status</th><th>Check</th></tr></thead>
                <tbody>
                  {checks.map(({ e, sum }) => (
                    <tr key={e.id} className={e.status === 'draft' ? 'draft' : ''}>
                      <td className="nowrap">{fmtUtc(e.timeUtc)}</td>
                      <td>{eventTypeById(e.typeId)?.name ?? e.typeId}</td>
                      <td>{e.status === 'draft' ? <span className="badge badge-amber">Draft (won't send)</span> : <span className="badge badge-muted">Ready</span>}</td>
                      <td>
                        {sum.errors > 0 ? <span className="badge badge-err">{sum.errors} error(s)</span>
                          : sum.warnings > 0 ? <span className="badge badge-warn">{sum.warnings} warning(s)</span>
                          : <span className="badge badge-ok">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="hint" style={{ marginTop: 8 }}>
            Drafts and events with red errors are never sent. Blue warnings can be sent but should be reviewed.
          </div>
        </div>
      )}

      {tab === 'archive' && (
        <div className="card">
          <h2>Archive</h2>
          {db.archive.length === 0 ? (
            <div className="empty">No reports sent yet.</div>
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
                      <td><button className="btn-ghost btn-sm" onClick={() => resend(r.id)}>Resend</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="hint" style={{ marginTop: 8 }}>Lost e-mails are detected onshore; resend by report ID if requested.</div>
        </div>
      )}
    </div>
  );
}
