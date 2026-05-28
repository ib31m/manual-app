import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { DISPOSAL_EVENT_IDS, eventTypeById } from '../data/eventTypes';
import { fmtUtc, fmtDate, toCsv, downloadText } from '../lib/util';
import type { VesselEvent } from '../domain/types';

const METHOD_LABEL: Record<string, string> = {
  disposal_incineration: 'Incineration',
  disposal_ashore: 'Ashore',
  disposal_overboard: 'Over board',
  disposal_barge: 'By barge',
};

// §3.17 Garbage Record Book + §4.1 Log Abstract.
export function ReportsPage() {
  const { db, notify } = useApp();
  const [tab, setTab] = useState<'garbage' | 'abstract'>('garbage');
  if (!db) return null;

  const disposals = db.events
    .filter((e) => DISPOSAL_EVENT_IDS.includes(e.typeId))
    .sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));

  const partI = disposals.filter((e) => (e.fields['garbage_part'] ?? 'I') !== 'II');
  const partII = disposals.filter((e) => e.fields['garbage_part'] === 'II');

  function exportGarbage() {
    const rows: (string | number)[][] = [['Part', 'Date (UTC)', 'Category', 'Amount (m³)', 'Method', 'Position', 'Voyage']];
    disposals.forEach((e) => {
      rows.push([
        String(e.fields['garbage_part'] ?? 'I'),
        fmtUtc(e.timeUtc),
        String(e.fields['garbage_category'] ?? ''),
        Number(e.fields['garbage_amount'] ?? 0),
        METHOD_LABEL[e.typeId] ?? '',
        e.position ? `${e.position.lat ?? ''}, ${e.position.lon ?? ''}` : '',
        db!.voyages.find((v) => v.id === e.voyageId)?.voyageNo ?? '',
      ]);
    });
    downloadText('garbage_record_book.csv', toCsv(rows));
    notify('ok', 'Garbage Record Book exported (CSV).');
  }

  function exportAbstract() {
    const rows: (string | number)[][] = [
      ['Time (UTC)', 'Time zone', 'Event', 'Voyage', 'Lat', 'Lon', 'SOG (kn)', 'STW (kn)', 'Wind (Bft)', 'Total cons. (mt)', 'Status'],
    ];
    [...db!.events]
      .sort((a, b) => a.timeUtc.localeCompare(b.timeUtc))
      .forEach((e) => {
        const cons = e.consumptions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
        rows.push([
          fmtUtc(e.timeUtc), e.timeZoneLabel, eventTypeById(e.typeId)?.name ?? e.typeId,
          db!.voyages.find((v) => v.id === e.voyageId)?.voyageNo ?? '',
          e.position?.lat ?? '', e.position?.lon ?? '', e.sogKn ?? '', e.stwKn ?? '',
          e.weather?.windForceBft ?? '', cons.toFixed(2), e.status,
        ]);
      });
    downloadText('log_abstract.csv', toCsv(rows));
    notify('ok', 'Log Abstract exported (CSV).');
  }

  return (
    <div className="stack">
      <div className="pill-group">
        <span className={`pill${tab === 'garbage' ? ' active' : ''}`} onClick={() => setTab('garbage')}>Garbage Record Book</span>
        <span className={`pill${tab === 'abstract' ? ' active' : ''}`} onClick={() => setTab('abstract')}>Log Abstract</span>
      </div>

      {tab === 'garbage' && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Garbage Record Book</h2>
              <small>MARPOL Annex V — derived from disposal events.</small>
            </div>
            <button onClick={exportGarbage} disabled={disposals.length === 0}>Export to Excel (CSV)</button>
          </div>

          <div className="section-title">Part I — all garbage other than cargo residues</div>
          <GarbageTable rows={partI} db={db} />

          <div className="section-title">Part II — cargo residues (solid bulk cargo)</div>
          <GarbageTable rows={partII} db={db} />

          <div className="hint" style={{ marginTop: 10 }}>
            Record disposal events (incineration / ashore / over board / by barge) from the Events
            page; they appear here automatically.
          </div>
        </div>
      )}

      {tab === 'abstract' && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Log Abstract</h2>
              <small>One row per event after the voyage filter — for quality checks and external assessment.</small>
            </div>
            <button onClick={exportAbstract} disabled={db.events.length === 0}>Export to Excel (CSV)</button>
          </div>
          <p className="text-muted">{db.events.length} event(s) available for export.</p>
        </div>
      )}
    </div>
  );
}

function GarbageTable({ rows, db }: { rows: VesselEvent[]; db: import('../domain/types').OnboardDB }) {
  if (rows.length === 0) return <div className="empty">No entries.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Method</th><th>Position</th><th>Voyage</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="nowrap">{fmtDate(e.timeUtc)}</td>
              <td>{String(e.fields['garbage_category'] ?? '—')}</td>
              <td>{e.fields['garbage_amount'] ? `${e.fields['garbage_amount']} m³` : '—'}</td>
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
