import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { EVENT_TYPES, eventTypeById, eventsInSequence } from '../data/eventTypes';
import { deriveVoyageState } from '../domain/sequence';
import { validateEvent, summarize, isFlaggedOffHire } from '../domain/validation';
import { baselineWithout } from '../domain/fuelLedger';
import type { EventCategory, VesselEvent } from '../domain/types';
import { fmtUtc } from '../lib/util';
import { Modal } from '../components/common/Modal';
import { EventEditor } from './EventEditor';
import { portLabel } from '../data/ports';
import { CheckChip, StatusChip, StateChip } from '../components/common/Status';

interface EditorState {
  mode: 'new' | 'edit';
  typeId: string;
  eventId?: string;
}

export function EventsPage() {
  const { db } = useApp();
  const [filterVoyage, setFilterVoyage] = useState<string>('all');
  const [picker, setPicker] = useState<EventCategory | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);

  // Hooks must run unconditionally — guard inside the memo, return after.
  const events = useMemo(() => {
    if (!db) return [];
    return [...db.events]
      .filter((e) => filterVoyage === 'all' || e.voyageId === filterVoyage)
      .sort((a, b) => b.timeUtc.localeCompare(a.timeUtc));
  }, [db, filterVoyage]);

  if (!db) return null;
  const state = deriveVoyageState(db.events);
  const inSeq = new Set(eventsInSequence(state).map((e) => e.id));

  function startNew(typeId: string) {
    setPicker(null);
    setShowMore(false);
    setEditor({ mode: 'new', typeId });
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div className="row wrap" style={{ gap: 16 }}>
            <div>
              <label style={{ marginBottom: 2 }}>Voyage filter</label>
              <select value={filterVoyage} onChange={(e) => setFilterVoyage(e.target.value)} style={{ minWidth: 220 }}>
                <option value="all">All voyages</option>
                {db.voyages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voyageNo} — {portLabel(v.departurePort)} → {portLabel(v.arrivalPort)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ marginBottom: 2 }}>Current voyage state</label>
              <div><StateChip state={state} /></div>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn-primary" onClick={() => setPicker('Voyage')}>+ Voyage event</button>
            <button onClick={() => setPicker('Special')}>+ Special event</button>
            <button onClick={() => setPicker('Operational')}>+ Operational event</button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="empty"><span className="ico">📝</span>No events for this filter. Use the “+ … event” buttons to file an event.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Event</th>
                  <th>Voyage</th>
                  <th className="num">Dist.</th>
                  <th className="num">Cons.</th>
                  <th>Status</th>
                  <th>Value check</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <EventRow key={e.id} event={e} onEdit={() => setEditor({ mode: 'edit', typeId: e.typeId, eventId: e.id })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {picker && (
        <Modal title={`File a new ${picker.toLowerCase()} event`} onClose={() => { setPicker(null); setShowMore(false); }}>
          <p className="text-muted">
            By default only events matching the reporting sequence (state: <strong>{state}</strong>) are
            shown. Use “Show more…” to file an out-of-sequence event.
          </p>
          <div className="stack">
            {EVENT_TYPES.filter((t) => t.category === picker)
              .filter((t) => showMore || inSeq.has(t.id))
              .map((t) => (
                <button
                  key={t.id}
                  className="btn-block"
                  style={{ textAlign: 'left', opacity: inSeq.has(t.id) ? 1 : 0.6 }}
                  onClick={() => startNew(t.id)}
                >
                  <strong>{t.name}</strong>
                  {!inSeq.has(t.id) && <span className="badge badge-muted" style={{ marginLeft: 8 }}>out of sequence</span>}
                  <div className="text-muted" style={{ fontSize: '.8rem' }}>{t.description}</div>
                </button>
              ))}
          </div>
          {!showMore && (
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setShowMore(true)}>
              Show more… (all {picker.toLowerCase()} events)
            </button>
          )}
        </Modal>
      )}

      {editor && (
        <EventEditor
          mode={editor.mode}
          typeId={editor.typeId}
          eventId={editor.eventId}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

function EventRow({ event, onEdit }: { event: VesselEvent; onEdit: () => void }) {
  const { db } = useApp();
  if (!db) return null;
  const def = eventTypeById(event.typeId);
  // Validate against the baseline that excludes this event's own (saved) effect.
  const base = event.status === 'sent' ? db : baselineWithout(db, event.id);
  const sum = summarize(validateEvent(base, event));
  const flagged = isFlaggedOffHire(db, event);
  const cons = event.consumptionsSkipped ? 0 : event.consumptions.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  return (
    <tr className={`clickable${event.status === 'draft' ? ' draft' : ''}${flagged ? ' flagged' : ''}`} onClick={onEdit}>
      <td className="nowrap">
        {fmtUtc(event.timeUtc)}
        <div className="text-muted" style={{ fontSize: '.74rem' }}>{event.timeZoneLabel}</div>
      </td>
      <td>
        {def?.name ?? event.typeId}
        {event.fields['port'] ? <div className="text-muted" style={{ fontSize: '.78rem' }}>{portLabel(String(event.fields['port']))}</div> : null}
        {flagged && <span className="chip chip-amber" style={{ marginTop: 4 }}><span className="dot" />Off-hire</span>}
      </td>
      <td>{db.voyages.find((v) => v.id === event.voyageId)?.voyageNo ?? <span className="text-err">none</span>}</td>
      <td className="num">{event.distanceNm ? event.distanceNm : '—'}</td>
      <td className="num">{cons > 0 ? cons.toFixed(1) : event.consumptionsSkipped ? 'skip' : '—'}</td>
      <td><StatusChip status={event.status} /></td>
      <td><CheckChip summary={sum} sent={event.status === 'sent'} /></td>
      <td onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost btn-sm" onClick={onEdit}>{event.status === 'sent' ? 'View' : 'Edit'}</button>
      </td>
    </tr>
  );
}
